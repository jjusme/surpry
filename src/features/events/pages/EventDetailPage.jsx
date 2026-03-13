import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/layout/AppShell";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { FormField } from "../../../components/ui/FormField";
import { Avatar } from "../../../components/ui/Avatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { CountdownTimer } from "../../../components/ui/CountdownTimer";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import { requireSupabase } from "../../../lib/supabase";
import {
  addGiftOption,
  createExpenseWithShares,
  getEventDetail,
  reviewShare,
  updateGiftStatus,
  uploadPrivateFile
} from "../service";
import { listPaymentDestinations } from "../../profile/service";
import { EVENT_TABS, EXPENSE_CATEGORIES } from "../../../lib/constants";
import { formatCurrency, formatDate } from "../../../utils/format";
import { cn } from "../../../utils/cn";

const initialGiftForm = { title: "", url: "", price_estimate: "", notes: "" };
const initialExpenseForm = {
  title: "",
  description: "",
  category: "gift",
  amount: "",
  reimbursement_destination_id: ""
};

export function EventDetailPage() {
  const { eventId } = useParams();
  const queryClient = useQueryClient();
  const { user, isSupabaseConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState("resumen");
  const [giftForm, setGiftForm] = useState(initialGiftForm);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);

  const detailQuery = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: () => getEventDetail(eventId),
    enabled: Boolean(eventId && isSupabaseConfigured)
  });
  const paymentQuery = useQuery({
    queryKey: ["payment-destinations", user?.id],
    queryFn: () => listPaymentDestinations(user.id),
    enabled: Boolean(user?.id && isSupabaseConfigured)
  });

  useEffect(() => {
    if (!eventId || !isSupabaseConfigured) return;

    const supabase = requireSupabase();
    const channel = supabase
      .channel(`event_${eventId}_activity`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gift_options', filter: `event_id=eq.${eventId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `event_id=eq.${eventId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_shares' }, () => {
        queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, isSupabaseConfigured, queryClient]);

  const giftMutation = useMutation({
    mutationFn: (values) => addGiftOption(eventId, values),
    onSuccess: async () => {
      setGiftForm(initialGiftForm);
      toast.success("Regalo propuesto exitosamente");
      await queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
    onError: (error) => toast.error(error.message)
  });

  const giftStatusMutation = useMutation({
    mutationFn: ({ giftId, status }) => updateGiftStatus(eventId, giftId, status, user.id),
    onSuccess: async () => {
      toast.success("Estado del regalo actualizado");
      queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] })
    },
    onError: (error) => toast.error(error.message)
  });

  const expenseMutation = useMutation({
    mutationFn: async (values) => {
      let receiptPath = null;
      if (receiptFile) {
        receiptPath = await uploadPrivateFile(
          "expense-receipts",
          `expenses/${eventId}/${crypto.randomUUID()}-${receiptFile.name}`,
          receiptFile
        );
      }
      return createExpenseWithShares({
        ...values,
        event_id: eventId,
        paid_by_user_id: user.id,
        receipt_path: receiptPath
      });
    },
    onSuccess: async () => {
      setExpenseForm(initialExpenseForm);
      setReceiptFile(null);
      setSelectedParticipants([]);
      toast.success("Gasto registrado y dividido");
      await queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
    onError: (error) => toast.error(error.message)
  });

  const reviewMutation = useMutation({
    mutationFn: ({ shareId, action }) => reviewShare(shareId, action),
    onSuccess: async () => {
      toast.success("Revisión confirmada");
      queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
    onError: (error) => toast.error(error.message)
  });

  const participants = detailQuery.data?.participants || [];
  const gifts = detailQuery.data?.gifts || [];
  const expenses = detailQuery.data?.expenses || [];
  const activity = detailQuery.data?.activity || [];
  const event = detailQuery.data?.event;

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const priceGoal = gifts.find((g) => g.price_estimate)?.price_estimate || 0;
  const fundingPct = priceGoal > 0 ? Math.min(100, Math.round((totalExpenses / priceGoal) * 100)) : 0;

  const myShares = useMemo(
    () =>
      expenses.flatMap((expense) =>
        (expense.shares || [])
          .filter((s) => s.user_id === user?.id)
          .map((s) => ({ ...s, expense }))
      ),
    [expenses, user?.id]
  );

  const sharesToReview = useMemo(
    () =>
      expenses.flatMap((expense) =>
        (expense.shares || [])
          .filter((s) => expense.paid_by_user_id === user?.id && s.user_id !== user?.id)
          .map((s) => ({ ...s, expense }))
      ),
    [expenses, user?.id]
  );

  const toggleParticipant = (pid) =>
    setSelectedParticipants((cur) =>
      cur.includes(pid) ? cur.filter((id) => id !== pid) : [...cur, pid]
    );

  const submitGift = async (e) => {
    e.preventDefault();
    await giftMutation.mutateAsync({ ...giftForm, proposed_by: user.id });
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    if (selectedParticipants.length === 0) {
      toast.error("Selecciona al menos un cómplice para dividir el gasto.");
      return;
    }
    await expenseMutation.mutateAsync({ ...expenseForm, participant_ids: selectedParticipants });
  };

  if (detailQuery.isLoading || paymentQuery.isLoading)
    return <LoadingState message="Cargando detalles..." fullScreen />;

  if (detailQuery.error || paymentQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar esta sorpresa"
          description={detailQuery.error?.message || paymentQuery.error?.message}
          onRetry={() => {
            detailQuery.refetch();
            paymentQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeTab="eventos"
      header={
        <PageHeader
          subtitle="Plan Sorpresa"
          title={event?.birthday_profile?.display_name || "Sorpresa"}
          backTo="/eventos"
        />
      }
    >
      <div className="space-y-4 pt-4 pb-12">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 py-4 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <Avatar
              name={event?.birthday_profile?.display_name}
              url={event?.birthday_profile?.avatar_url}
              className="size-28 text-2xl ring-4 ring-bg shadow-float"
              ring
            />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-950 shadow-float ring-2 ring-bg">
              Homenajeado
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <h2 className="text-2xl font-black text-text tracking-tight">
              {event?.birthday_profile?.display_name}
            </h2>
            <p className="text-sm font-medium italic text-text-muted">"¡Shhh! Es un plan secreto."</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-4 py-1.5 border border-border/50">
              <span
                className="material-symbols-outlined text-[1rem] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                calendar_today
              </span>
              <span className="text-xs font-bold text-text">
                Festa: {formatDate(event?.birthday_date, { day: "numeric", month: "long" }).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Countdown */}
          {event?.birthday_date && (
            <div className="w-full pt-2">
              <CountdownTimer targetDate={event.birthday_date} />
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="sticky top-[3.75rem] z-10 -mx-4 border-b border-border bg-bg/95 px-4 backdrop-blur-md">
          <div className="flex gap-1 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none" }}>
            {EVENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "flex-shrink-0 border-b-2 px-4 py-4 text-sm font-black uppercase tracking-wider transition-all",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted hover:text-text opacity-60"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* RESUMEN */}
        {activeTab === "resumen" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <Card className="space-y-5 shadow-sm border-l-4 border-primary p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-1">
                    Estado del plan
                  </p>
                  <StatusBadge status={event?.status}>
                    {event?.status === 'active' ? 'EN MARCHA' : event?.status.toUpperCase()}
                  </StatusBadge>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <span
                    className="material-symbols-outlined text-primary text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    rocket_launch
                  </span>
                </div>
              </div>

              {priceGoal > 0 && (
                <ProgressBar
                  label="Fondo para el regalo"
                  rightLabel={`${formatCurrency(totalExpenses)} / ${formatCurrency(priceGoal)}`}
                  value={fundingPct}
                />
              )}
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                  Cómplices activos
                </p>
                <span className="text-xs font-black text-primary">{participants.length} conectados</span>
              </div>
              <div className="grid gap-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl bg-surface/50 border border-border/40 px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <Avatar
                      name={p.profiles?.display_name}
                      url={p.profiles?.avatar_url}
                      className="size-10 ring-2 ring-bg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text">
                        {p.profiles?.display_name}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">{p.role}</p>
                    </div>
                    <div className="flex size-7 items-center justify-center rounded-full bg-success/10">
                      <span
                        className="material-symbols-outlined text-[1rem] text-success"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REGALO */}
        {activeTab === "regalo" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <Card className="space-y-5 p-5 shadow-sm border-t-2 border-primary/20">
              <div>
                <h3 className="text-lg font-black text-text tracking-tight">Proponer regalo</h3>
                <p className="text-sm font-medium text-text-muted mt-1 leading-relaxed">
                  Idea nueva o referencia del cumpleañero. ¡Ayuda a decidir!
                </p>
              </div>
              <form className="space-y-4" onSubmit={submitGift}>
                <FormField label="¿Qué tienes en mente?">
                  <Input
                    placeholder="Ej. Audífonos Bluetooth"
                    value={giftForm.title}
                    onChange={(e) => setGiftForm((c) => ({ ...c, title: e.target.value }))}
                  />
                </FormField>
                <FormField label="Link del producto (opcional)">
                  <Input
                    placeholder="https://amazon.com.mx/..."
                    value={giftForm.url}
                    onChange={(e) => setGiftForm((c) => ({ ...c, url: e.target.value }))}
                  />
                </FormField>
                <FormField label="Precio aproximado">
                  <Input
                    type="number"
                    placeholder="2500"
                    value={giftForm.price_estimate}
                    onChange={(e) =>
                      setGiftForm((c) => ({ ...c, price_estimate: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Notas o detalles">
                  <TextArea
                    rows={2}
                    placeholder="Talle, color o por qué crees que es buena idea."
                    value={giftForm.notes}
                    onChange={(e) => setGiftForm((c) => ({ ...c, notes: e.target.value }))}
                  />
                </FormField>
                <Button
                  type="submit"
                  size="pill"
                  className="w-full font-black text-base h-12"
                  disabled={giftMutation.isPending || !giftForm.title.trim()}
                >
                  {giftMutation.isPending ? "Agregando..." : "Subir propuesta"}
                </Button>
              </form>
            </Card>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted px-1">Opciones actuales</p>
              {gifts.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-border p-8 text-center space-y-2 bg-surface/30">
                  <span className="material-symbols-outlined text-text-muted/20 text-4xl">inventory_2</span>
                  <p className="text-sm font-medium text-text-muted italic">Aún no hay propuestas de regalo en este plan.</p>
                </div>
              ) : (
                gifts.map((gift) => (
                  <Card key={gift.id} className="space-y-4 p-5 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-text text-lg tracking-tight leading-tight">{gift.title}</p>
                        {gift.price_estimate ? (
                          <p className="text-sm font-black text-primary">
                            {formatCurrency(gift.price_estimate)}
                          </p>
                        ) : null}
                        {gift.notes ? (
                          <p className="text-sm text-text-muted italic leading-relaxed pt-1">"{gift.notes}"</p>
                        ) : null}
                      </div>
                      <StatusBadge status={gift.status}>{gift.status === 'proposed' ? 'IDEA' : gift.status.toUpperCase()}</StatusBadge>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="md"
                        className="flex-1 text-xs font-black uppercase rounded-xl h-10"
                        onClick={() =>
                          giftStatusMutation.mutate({ giftId: gift.id, status: "reserved" })
                        }
                      >
                        Lo pido yo
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        className="flex-1 text-xs font-black uppercase rounded-xl h-10"
                        onClick={() =>
                          giftStatusMutation.mutate({ giftId: gift.id, status: "bought" })
                        }
                      >
                        ¡Comprado!
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        className="flex-none size-10 flex items-center justify-center rounded-xl p-0"
                        onClick={() =>
                          giftStatusMutation.mutate({ giftId: gift.id, status: "discarded" })
                        }
                      >
                        <span className="material-symbols-outlined text-danger/60">delete</span>
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* GASTOS */}
        {activeTab === "gastos" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <Card className="space-y-5 p-5 shadow-sm">
              <div>
                <h3 className="text-lg font-black text-text tracking-tight">Dividir un gasto</h3>
                <p className="text-sm font-medium text-text-muted mt-1 leading-relaxed">
                  ¿Pagaste algo? Regístralo aquí para que los demás te paguen su parte.
                </p>
              </div>
              <form className="space-y-4" onSubmit={submitExpense}>
                <FormField label="¿Qué se compró?">
                  <Input
                    placeholder="Ej. El pastel de chocolate"
                    value={expenseForm.title}
                    onChange={(e) =>
                      setExpenseForm((c) => ({ ...c, title: e.target.value }))
                    }
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Tipo de gasto">
                    <Select
                      value={expenseForm.category}
                      onChange={(e) =>
                        setExpenseForm((c) => ({ ...c, category: e.target.value }))
                      }
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Costo total">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) =>
                        setExpenseForm((c) => ({ ...c, amount: e.target.value }))
                      }
                    />
                  </FormField>
                </div>
                <FormField label="¿Dónde quieres que te reembolsen?">
                  <Select
                    value={expenseForm.reimbursement_destination_id}
                    onChange={(e) =>
                      setExpenseForm((c) => ({
                        ...c,
                        reimbursement_destination_id: e.target.value
                      }))
                    }
                  >
                    <option value="">Selecciona tu método de pago</option>
                    {paymentQuery.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label || item.type}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div className="space-y-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted px-1">Dividir con:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {participants.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-2xl border text-left transition-all",
                          selectedParticipants.includes(p.user_id)
                            ? "bg-primary/10 border-primary text-text shadow-sm"
                            : "bg-surface border-border/50 text-text-muted grayscale-[0.5] opacity-60"
                        )}
                        onClick={() => toggleParticipant(p.user_id)}
                      >
                        <Avatar name={p.profiles?.display_name} url={p.profiles?.avatar_url} className="size-6" />
                        <span className="text-xs font-bold truncate">{p.profiles?.display_name?.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <FormField label="Foto del ticket (opcional)">
                  <Input
                    type="file"
                    className="p-2 h-auto text-xs"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                </FormField>
                <Button
                  type="submit"
                  size="pill"
                  className="w-full font-black text-base h-12 shadow-lg"
                  disabled={
                    expenseMutation.isPending || !expenseForm.title.trim() || !expenseForm.amount
                  }
                >
                  {expenseMutation.isPending ? "Calculando shares..." : "Registrar y dividir"}
                </Button>
              </form>
            </Card>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted px-1">Historial de gastos</p>
              {expenses.length === 0 ? (
                <div className="rounded-[2rem] bg-surface/30 border border-dashed border-border p-8 text-center space-y-2">
                  <span className="material-symbols-outlined text-text-muted/20 text-4xl">payments</span>
                  <p className="text-sm font-medium text-text-muted italic">Todavía no hay gastos registrados.</p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <Card key={expense.id} className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-bold text-text tracking-tight">{expense.title}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted opacity-60">
                          {expense.category}
                        </p>
                      </div>
                      <p className="text-lg font-black text-primary">
                        {formatCurrency(expense.amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-surface-muted/50 p-4 border border-border/30">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                        División entre cómplices
                      </p>
                      <div className="space-y-2.5">
                        {(expense.shares || []).map((share) => (
                          <div key={share.id} className="flex items-center justify-between text-xs">
                            <span className="font-bold text-text-muted flex items-center gap-2">
                              <span className={cn(
                                "size-1.5 rounded-full",
                                share.status === 'confirmed' ? "bg-success" : "bg-warning"
                              )}></span>
                              {share.user_id === user?.id ? "Tú" : participants.find(p => p.user_id === share.user_id)?.profiles?.display_name?.split(" ")[0]}
                            </span>
                            <span className="font-black text-text">
                              {formatCurrency(share.amount_due)} <span className="text-[9px] opacity-40 ml-1 font-bold">({share.status.toUpperCase()})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* PAGOS */}
        {activeTab === "pagos" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <Card className="space-y-5 p-5 shadow-sm">
              <h3 className="text-lg font-black text-text tracking-tight uppercass">Tus cuentas pendientes</h3>
              {myShares.length === 0 ? (
                <div className="py-4 text-center">
                  <span className="material-symbols-outlined text-success opacity-20 text-4xl mb-2">verified</span>
                  <p className="text-sm font-medium text-text-muted italic">
                    ¡Estás al día! No tienes pagos pendientes aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myShares.map((share) => (
                    <Link
                      key={share.id}
                      to={`/shares/${share.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-surface-muted/50 border border-border/40 p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-0.5 opacity-60">{share.expense.title}</p>
                        <StatusBadge status={share.status} size="sm">{share.status.toUpperCase()}</StatusBadge>
                      </div>
                      <p className="text-lg font-black text-primary">
                        {formatCurrency(share.amount_due)}
                      </p>
                      <span className="material-symbols-outlined text-text-muted/30">chevron_right</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-5 p-5 shadow-sm border-t-4 border-success/30">
              <h3 className="text-lg font-black text-text tracking-tight">Confirmar recibos</h3>
              <p className="text-xs font-medium text-text-muted leading-relaxed">Confirma cuando un cómplice te haya pagado para cerrar el saldo.</p>
              {sharesToReview.length === 0 ? (
                <p className="text-sm font-medium text-text-muted italic opacity-60 text-center py-2">No hay pagos por revisar por ahora.</p>
              ) : (
                <div className="space-y-4">
                  {sharesToReview.map((share) => (
                    <div key={share.id} className="space-y-4 rounded-2xl bg-surface-muted p-4 border border-border/40">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-0.5 opacity-60">{share.expense.title}</p>
                          <p className="text-sm font-bold text-text">De: {participants.find(p => p.user_id === share.user_id)?.profiles?.display_name}</p>
                        </div>
                        <p className="text-lg font-black text-success">
                          {formatCurrency(share.amount_due)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          className="flex-1 h-10 text-xs font-black uppercase rounded-xl"
                          onClick={() =>
                            reviewMutation.mutate({ shareId: share.id, action: "confirmed" })
                          }
                        >
                          Lo recibí
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-none w-20 h-10 text-xs font-black uppercase rounded-xl border-danger/20 text-danger"
                          onClick={() =>
                            reviewMutation.mutate({ shareId: share.id, action: "rejected" })
                          }
                        >
                          No
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ACTIVIDAD */}
        {activeTab === "actividad" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted px-1 mb-4 text-center">Línea del tiempo del plan</p>
            {activity.length === 0 ? (
              <EmptyState
                icon="history"
                title="Comenzando..."
                description="Aquí verás cada paso que den los cómplices para esta sorpresa."
              />
            ) : (
              <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-8 before:w-0.5 before:bg-border/30">
                {activity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4"
                  >
                    <div className="relative z-10 flex size-16 flex-shrink-0 items-center justify-center rounded-2xl bg-surface border border-border/40 shadow-sm text-primary">
                      <span
                        className="material-symbols-outlined text-[1.4rem]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {entry.action_type.includes('regalo') ? 'redeem' : entry.action_type.includes('gasto') ? 'payments' : 'history'}
                      </span>
                    </div>
                    <div className="pt-2 flex-1">
                      <p className="text-sm font-bold text-text leading-tight">{entry.action_type}</p>
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mt-1 opacity-50">
                        {formatDate(entry.created_at, {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short"
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
