import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "../../../components/ui/NotificationBell";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { FormField } from "../../../components/ui/FormField";
import { Avatar } from "../../../components/ui/Avatar";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { AiSuggestionCard } from "../../../components/ui/AiSuggestionCard";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { requireSupabase } from "../../../lib/supabase";
import { formatCurrency, formatDate } from "../../../utils/format";
import { cn } from "../../../utils/cn";
import {
  getExchange,
  getMyAssignment,
  joinExchange,
  leaveExchange,
  setPurchased,
  addExclusion,
  removeExclusion,
  drawExchange,
  resetExchange,
  updateExchange,
  closeExchange,
  deleteExchange
} from "../service";
import { getProfileById } from "../../profile/service";
import { listMyWishlist } from "../../wishlist/service";
import { suggestGifts as suggestGiftsApi } from "../../ai/service";

const STATUS_LABEL = {
  open: { label: "Abierto", cls: "bg-primary/15 text-primary-strong" },
  drawn: { label: "Sorteado", cls: "bg-success/15 text-success" },
  closed: { label: "Cerrado", cls: "bg-surface-muted text-text-muted" }
};

export function ExchangeDetailPage() {
  const navigate = useNavigate();
  const { exchangeId } = useParams();
  const { user, isSupabaseConfigured } = useAuth();
  const queryClient = useQueryClient();

  const [confirm, setConfirm] = useState(null);
  const [exclA, setExclA] = useState("");
  const [exclB, setExclB] = useState("");
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", budget: "", exchange_date: "", description: "" });
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const detailQuery = useQuery({
    queryKey: ["exchange-detail", exchangeId],
    queryFn: () => getExchange(exchangeId),
    enabled: Boolean(exchangeId && isSupabaseConfigured)
  });

  const exchange = detailQuery.data?.exchange;
  const participants = detailQuery.data?.participants ?? [];
  const exclusions = detailQuery.data?.exclusions ?? [];
  const isParticipant = participants.some((p) => p.user_id === user?.id);
  const myParticipant = participants.find((p) => p.user_id === user?.id);
  const purchasedCount = participants.filter((p) => p.has_purchased).length;

  const adminQuery = useQuery({
    queryKey: ["group-admin", exchange?.group_id, user?.id],
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", exchange.group_id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.role === "admin";
    },
    enabled: Boolean(exchange?.group_id && user?.id)
  });
  const isManager = exchange?.created_by === user?.id || adminQuery.data === true;

  const assignmentQuery = useQuery({
    queryKey: ["exchange-assignment", exchangeId, user?.id],
    queryFn: () => getMyAssignment(exchangeId, user.id),
    enabled: Boolean(exchangeId && user?.id && exchange?.status !== "open" && isParticipant)
  });
  const receiver = assignmentQuery.data;

  const receiverDataQuery = useQuery({
    queryKey: ["exchange-receiver", exchangeId, receiver?.id],
    queryFn: async () => {
      const [profile, wishlist] = await Promise.all([
        getProfileById(receiver.id),
        listMyWishlist(receiver.id)
      ]);
      return { profile, wishlist: wishlist ?? [] };
    },
    enabled: Boolean(receiver?.id)
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["exchange-detail", exchangeId] });

  const joinMutation = useMutation({
    mutationFn: () => joinExchange(exchangeId, user.id),
    onSuccess: () => { toast.success("¡Te uniste al intercambio!"); invalidate(); },
    onError: (e) => toast.error(e.message)
  });
  const leaveMutation = useMutation({
    mutationFn: () => leaveExchange(exchangeId, user.id),
    onSuccess: () => { toast.success("Saliste del intercambio"); invalidate(); },
    onError: (e) => toast.error(e.message)
  });
  const removeParticipantMutation = useMutation({
    mutationFn: (userId) => leaveExchange(exchangeId, userId),
    onSuccess: () => { toast.success("Participante quitado"); invalidate(); },
    onError: (e) => toast.error(e.message)
  });
  const purchasedMutation = useMutation({
    mutationFn: (value) => setPurchased(exchangeId, user.id, value),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message)
  });
  const addExclusionMutation = useMutation({
    mutationFn: () => addExclusion(exchangeId, exclA, exclB),
    onSuccess: () => { setExclA(""); setExclB(""); toast.success("Restricción agregada"); invalidate(); },
    onError: (e) => toast.error(e.message)
  });
  const removeExclusionMutation = useMutation({
    mutationFn: (id) => removeExclusion(id),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message)
  });
  const drawMutation = useMutation({
    mutationFn: () => drawExchange(exchangeId),
    onSuccess: () => {
      toast.success("¡Sorteo realizado! 🎉");
      queryClient.invalidateQueries({ queryKey: ["exchange-detail", exchangeId] });
      queryClient.invalidateQueries({ queryKey: ["exchange-assignment", exchangeId] });
    },
    onError: (e) => toast.error(e.message)
  });
  const resetMutation = useMutation({
    mutationFn: () => resetExchange(exchangeId),
    onSuccess: () => {
      toast.success("Sorteo reiniciado");
      setAiSuggestions([]);
      queryClient.invalidateQueries({ queryKey: ["exchange-detail", exchangeId] });
      queryClient.invalidateQueries({ queryKey: ["exchange-assignment", exchangeId] });
    },
    onError: (e) => toast.error(e.message)
  });
  const updateMutation = useMutation({
    mutationFn: () => updateExchange(exchangeId, editForm),
    onSuccess: () => { setIsEditing(false); toast.success("Intercambio actualizado"); invalidate(); },
    onError: (e) => toast.error(e.message)
  });
  const closeMutation = useMutation({
    mutationFn: () => closeExchange(exchangeId),
    onSuccess: () => { toast.success("Intercambio cerrado"); invalidate(); },
    onError: (e) => toast.error(e.message)
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteExchange(exchangeId),
    onSuccess: () => {
      toast.success("Intercambio eliminado");
      window.history.back();
    },
    onError: (e) => toast.error(e.message)
  });

  const aiSuggestMutation = useMutation({
    mutationFn: () => suggestGiftsApi({
      birthdayName: receiver?.display_name || "",
      wishlist: (receiverDataQuery.data?.wishlist || []).map((w) => ({ title: w.title, price_estimate: w.price_estimate })),
      budget: exchange?.budget || null,
      interests: receiverDataQuery.data?.profile?.hobbies || [],
      dislikes: receiverDataQuery.data?.profile?.dislikes || []
    }),
    onSuccess: (data) => setAiSuggestions(data.suggestions || []),
    onError: (e) => toast.error(e.message)
  });

  if (detailQuery.isLoading) return <LoadingState message="Cargando intercambio..." fullScreen />;
  if (detailQuery.error || !exchange) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar el intercambio"
          description={detailQuery.error?.message}
          onRetry={() => detailQuery.refetch()}
        />
      </div>
    );
  }

  const status = STATUS_LABEL[exchange.status] || STATUS_LABEL.open;
  const startEdit = () => {
    setEditForm({
      name: exchange.name || "",
      budget: exchange.budget ?? "",
      exchange_date: exchange.exchange_date || "",
      description: exchange.description || ""
    });
    setIsEditing(true);
  };

  const askConfirm = (cfg) => setConfirm(cfg);

  return (
    <AppShell
      activeTab="grupos"
      header={
        <PageHeader action={<NotificationBell />} />
      }
    >
      <div className="space-y-4 pt-4 pb-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-bold text-text-muted active:text-text transition-colors">
          <span className="material-symbols-outlined text-[1rem]">arrow_back</span>
          Volver
        </button>
        {/* Hero / status */}
        <div
          className="flex flex-col items-center gap-3 py-6 text-center rounded-3xl px-4 mx-[-0.5rem]"
          style={{ background: "linear-gradient(160deg, rgba(34,197,94,0.13) 0%, rgba(239,68,68,0.07) 55%, transparent 100%)" }}
        >
          <div className="relative">
            <div className="size-24 rounded-[2rem] bg-gradient-to-br from-green-500/25 to-emerald-600/15 flex items-center justify-center ring-4 ring-bg shadow-float">
              <span className="material-symbols-outlined text-green-600 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>redeem</span>
            </div>
            <span className="absolute -top-2 -right-2 text-xl select-none">⭐</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-700/80">🎄 Intercambio navideño</p>
            <h2 className="text-2xl font-black text-text tracking-tight">{exchange.name}</h2>
            <span className={cn("inline-block rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]", status.cls)}>
              {status.label}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-bold text-text">
            {exchange.budget ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5 border border-border/50">
                <span className="material-symbols-outlined text-[1rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                {formatCurrency(exchange.budget)}
              </span>
            ) : null}
            {exchange.exchange_date ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5 border border-border/50">
                <span className="material-symbols-outlined text-[1rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                {formatDate(exchange.exchange_date, { day: "numeric", month: "long" })}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5 border border-border/50">
              <span className="material-symbols-outlined text-[1rem] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              {participants.length}
            </span>
          </div>
          {exchange.description ? (
            <p className="text-sm font-medium text-text-muted max-w-sm">{exchange.description}</p>
          ) : null}
        </div>

        {/* ===== Mi asignación (sorteado/cerrado) ===== */}
        {exchange.status !== "open" && isParticipant && (
          <Card
            className="space-y-4 p-5 border-l-4 border-green-500/70"
            style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.07) 0%, transparent 60%)" }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-700/80">🎁 Te toca regalarle a</p>
            {assignmentQuery.isLoading ? (
              <LoadingState message="Revelando..." />
            ) : receiver ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={receiver.display_name} url={receiver.avatar_url} className="size-16 ring-2 ring-bg" ring />
                  <div>
                    <p className="text-xl font-black text-text">{receiver.display_name}</p>
                    {exchange.budget ? (
                      <p className="text-xs font-bold text-text-muted">Presupuesto: {formatCurrency(exchange.budget)}</p>
                    ) : null}
                  </div>
                </div>

                {/* Wishlist del receptor */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Su wishlist</p>
                  {receiverDataQuery.isLoading ? (
                    <p className="text-sm text-text-muted italic">Cargando wishlist...</p>
                  ) : (receiverDataQuery.data?.wishlist?.length ? (
                    <div className="space-y-2">
                      {receiverDataQuery.data.wishlist.map((w) => (
                        <div key={w.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface/50 border border-border/40 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text truncate">{w.title}</p>
                            {w.notes ? <p className="text-xs text-text-muted truncate">{w.notes}</p> : null}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {w.price_estimate ? <span className="text-xs font-black text-primary">{formatCurrency(w.price_estimate)}</span> : null}
                            {w.url ? (
                              <a href={w.url} target="_blank" rel="noreferrer" className="text-text-muted/60 hover:text-primary">
                                <span className="material-symbols-outlined text-[1.1rem]">open_in_new</span>
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted italic">Aún no tiene wishlist. ¡Usa la IA o su perfil para inspirarte!</p>
                  ))}
                </div>

                {/* Sugerencias IA */}
                <div className="space-y-3">
                  {aiSuggestions.length === 0 ? (
                    <Button
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={() => aiSuggestMutation.mutate()}
                      disabled={aiSuggestMutation.isPending}
                    >
                      <span className="material-symbols-outlined text-[1.1rem]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      {aiSuggestMutation.isPending ? "Pensando ideas..." : "Sugerir ideas con IA"}
                    </Button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Sugerencias IA</p>
                        <button type="button" onClick={() => setAiSuggestions([])} className="text-xs font-bold text-text-muted hover:text-text">Cerrar</button>
                      </div>
                      {aiSuggestions.map((s, i) => (
                        <AiSuggestionCard key={i} title={s.title} reason={s.reason} estimated_price={s.estimated_price} store={s.store} />
                      ))}
                    </>
                  )}
                </div>

                {/* Marcar comprado */}
                <Button
                  variant={myParticipant?.has_purchased ? "ghost" : "primary"}
                  className="w-full"
                  onClick={() => purchasedMutation.mutate(!myParticipant?.has_purchased)}
                  disabled={purchasedMutation.isPending}
                >
                  {myParticipant?.has_purchased ? "✓ Ya compré mi regalo (deshacer)" : "Marcar: ya compré mi regalo"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-text-muted italic">No tienes asignación en este intercambio.</p>
            )}
          </Card>
        )}

        {/* Progreso de compras (sorteado/cerrado) */}
        {exchange.status !== "open" && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Compras del grupo</p>
              <span className="text-xs font-black text-primary">{purchasedCount}/{participants.length} listos</span>
            </div>
          </Card>
        )}

        {/* ===== Participantes ===== */}
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-text tracking-tight">Participantes</h3>
            {exchange.status === "open" && (
              isParticipant ? (
                <button
                  type="button"
                  onClick={() => leaveMutation.mutate()}
                  disabled={leaveMutation.isPending}
                  className="text-xs font-bold text-danger/70 hover:text-danger"
                >
                  Salir
                </button>
              ) : (
                <Button size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                  Unirme
                </Button>
              )
            )}
          </div>
          <div className="grid gap-2">
            {(showAllParticipants ? participants : participants.slice(0, 4)).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface/50 border border-border/40 px-4 py-2.5">
                <Avatar name={p.profiles?.display_name} url={p.profiles?.avatar_url} className="size-9 ring-2 ring-bg" />
                <span className="flex-1 text-sm font-bold text-text truncate">
                  {p.profiles?.display_name}
                  {p.user_id === user?.id ? " (tú)" : ""}
                </span>
                {exchange.status !== "open" && p.has_purchased && (
                  <span className="material-symbols-outlined text-[1.1rem] text-success" style={{ fontVariationSettings: "'FILL' 1" }} title="Ya compró">check_circle</span>
                )}
                {exchange.status === "open" && isManager && p.user_id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => removeParticipantMutation.mutate(p.user_id)}
                    className="text-text-muted/30 hover:text-danger"
                    title="Quitar"
                  >
                    <span className="material-symbols-outlined text-[1rem]">close</span>
                  </button>
                )}
              </div>
            ))}
            {participants.length === 0 && (
              <EmptyState icon="group" title="Sin participantes" description="Aún no se ha unido nadie. ¡Sé el primero!" />
            )}
          </div>
          {participants.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllParticipants((v) => !v)}
              className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-black uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
            >
              {showAllParticipants ? (
                <>
                  <span className="material-symbols-outlined text-[1rem]">expand_less</span>
                  Ver menos
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[1rem]">expand_more</span>
                  Ver todos ({participants.length})
                </>
              )}
            </button>
          )}
        </Card>

        {/* ===== Controles del organizador (abierto) ===== */}
        {exchange.status === "open" && isManager && (
          <Card className="space-y-5 p-5 border-t-2 border-primary/20">
            <h3 className="text-lg font-black text-text tracking-tight">Organización</h3>

            {/* Exclusiones (pendiente) */}
            {/* <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Restricciones (parejas que NO se tocan)</p>
              {exclusions.length > 0 && (
                <div className="space-y-2">
                  {exclusions.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface/50 border border-border/40 px-4 py-2.5">
                      <span className="text-sm font-semibold text-text truncate">
                        {ex.a?.display_name} ✕ {ex.b?.display_name}
                      </span>
                      <button type="button" onClick={() => removeExclusionMutation.mutate(ex.id)} className="text-text-muted/40 hover:text-danger flex-shrink-0">
                        <span className="material-symbols-outlined text-[1rem]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Select value={exclA} onChange={(e) => setExclA(e.target.value)} className="flex-1">
                  <option value="">Persona A</option>
                  {participants.map((p) => (
                    <option key={p.user_id} value={p.user_id}>{p.profiles?.display_name}</option>
                  ))}
                </Select>
                <Select value={exclB} onChange={(e) => setExclB(e.target.value)} className="flex-1">
                  <option value="">Persona B</option>
                  {participants.map((p) => (
                    <option key={p.user_id} value={p.user_id}>{p.profiles?.display_name}</option>
                  ))}
                </Select>
                <Button
                  size="icon"
                  onClick={() => {
                    if (!exclA || !exclB || exclA === exclB) return toast.error("Elige dos personas distintas");
                    addExclusionMutation.mutate();
                  }}
                  disabled={addExclusionMutation.isPending || !exclA || !exclB}
                >
                  <span className="material-symbols-outlined text-[1.25rem]">add</span>
                </Button>
              </div>
            </div> */}

            {/* Editar */}
            {isEditing ? (
              <div className="space-y-3 rounded-2xl bg-surface/40 p-4 border border-border/40">
                <FormField label="Nombre">
                  <Input value={editForm.name} onChange={(e) => setEditForm((c) => ({ ...c, name: e.target.value }))} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Presupuesto">
                    <Input type="number" value={editForm.budget} onChange={(e) => setEditForm((c) => ({ ...c, budget: e.target.value }))} />
                  </FormField>
                  <FormField label="Fecha">
                    <Input type="date" value={editForm.exchange_date} onChange={(e) => setEditForm((c) => ({ ...c, exchange_date: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Descripción">
                  <TextArea rows={2} value={editForm.description} onChange={(e) => setEditForm((c) => ({ ...c, description: e.target.value }))} />
                </FormField>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Guardar</Button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={startEdit} className="text-xs font-bold text-primary hover:text-primary-strong">
                Editar detalles
              </button>
            )}

            {/* Sortear */}
            <Button
              size="pill"
              className="w-full h-12 font-black text-base"
              style={participants.length >= 3 ? { background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" } : undefined}
              onClick={() => askConfirm({
                title: "¿Realizar el sorteo?",
                description: "Se asignarán los amigos secretos y el intercambio quedará bloqueado para nuevos participantes. Podrás reiniciarlo si es necesario.",
                confirmLabel: "Sí, sortear",
                variant: "primary",
                onConfirm: () => drawMutation.mutate()
              })}
              disabled={drawMutation.isPending || participants.length < 3}
            >
              {participants.length < 3 ? "Faltan participantes (mín. 3)" : "🎄 Realizar sorteo"}
            </Button>

            <button
              type="button"
              onClick={() => askConfirm({
                title: "¿Eliminar intercambio?",
                description: "Se borrará el intercambio y todos sus datos. No se puede deshacer.",
                confirmLabel: "Sí, eliminar",
                variant: "danger",
                onConfirm: () => deleteMutation.mutate()
              })}
              className="w-full text-center text-xs font-black uppercase tracking-widest text-danger/50 hover:text-danger"
            >
              Eliminar intercambio
            </button>
          </Card>
        )}

        {/* ===== Controles del organizador (sorteado) ===== */}
        {exchange.status === "drawn" && isManager && (
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-black text-text tracking-tight">Organización</h3>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => askConfirm({
                title: "¿Reiniciar el sorteo?",
                description: "Se borrarán las asignaciones actuales y el intercambio volverá a estar abierto. Tendrás que sortear de nuevo.",
                confirmLabel: "Sí, reiniciar",
                variant: "danger",
                onConfirm: () => resetMutation.mutate()
              })}
              disabled={resetMutation.isPending}
            >
              Reiniciar sorteo
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => askConfirm({
                title: "¿Cerrar intercambio?",
                description: "El intercambio quedará marcado como finalizado. Las asignaciones se conservan.",
                confirmLabel: "Cerrar",
                variant: "primary",
                onConfirm: () => closeMutation.mutate()
              })}
              disabled={closeMutation.isPending}
            >
              Cerrar intercambio
            </Button>
            <button
              type="button"
              onClick={() => askConfirm({
                title: "¿Eliminar intercambio?",
                description: "Se borrará el intercambio y todos sus datos. No se puede deshacer.",
                confirmLabel: "Sí, eliminar",
                variant: "danger",
                onConfirm: () => deleteMutation.mutate()
              })}
              className="w-full text-center text-xs font-black uppercase tracking-widest text-danger/50 hover:text-danger pt-1"
            >
              Eliminar intercambio
            </button>
          </Card>
        )}

        <ConfirmDialog
          isOpen={Boolean(confirm)}
          title={confirm?.title}
          description={confirm?.description}
          confirmLabel={confirm?.confirmLabel}
          cancelLabel="Cancelar"
          variant={confirm?.variant}
          onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AppShell>
  );
}
