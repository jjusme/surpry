import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  const [serverError, setServerError] = useState("");

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

  const giftMutation = useMutation({
    mutationFn: (values) => addGiftOption(eventId, values),
    onSuccess: async () => {
      setGiftForm(initialGiftForm);
      await queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
    onError: (error) => setServerError(error.message)
  });

  const giftStatusMutation = useMutation({
    mutationFn: ({ giftId, status }) => updateGiftStatus(eventId, giftId, status, user.id),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] }),
    onError: (error) => setServerError(error.message)
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
      await queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
    onError: (error) => setServerError(error.message)
  });

  const reviewMutation = useMutation({
    mutationFn: ({ shareId, action }) => reviewShare(shareId, action),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] }),
    onError: (error) => setServerError(error.message)
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
    setServerError("");
    await giftMutation.mutateAsync({ ...giftForm, proposed_by: user.id });
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    setServerError("");
    if (selectedParticipants.length === 0) {
      setServerError("Selecciona al menos un participante para dividir el gasto.");
      return;
    }
    await expenseMutation.mutateAsync({ ...expenseForm, participant_ids: selectedParticipants });
  };

  if (detailQuery.isLoading || paymentQuery.isLoading)
    return <LoadingState message="Cargando evento..." fullScreen />;

  if (detailQuery.error || paymentQuery.error) {
    return (
      <div className="app-frame flex items-center px-4">
        <ErrorState
          title="No pudimos cargar este evento"
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
          subtitle="Operación"
          title={event?.birthday_profile?.display_name || "Evento secreto"}
          backTo="/eventos"
        />
      }
    >
      <div className="space-y-4 pt-4">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="relative">
            <Avatar
              name={event?.birthday_profile?.display_name}
              url={event?.birthday_profile?.avatar_url}
              className="size-28 text-2xl"
              ring
            />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-950 shadow-float">
              Target
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <h2 className="text-2xl font-extrabold text-text">
              {event?.birthday_profile?.display_name}
            </h2>
            <p className="text-sm italic text-text-muted">"¡Shhh! Es una misión secreta."</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5">
              <span
                className="material-symbols-outlined text-[1rem] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                calendar_month
              </span>
              <span className="text-xs font-bold text-text">
                Fecha objetivo:{" "}
                {formatDate(event?.birthday_date, { day: "numeric", month: "short" }).toUpperCase()}
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

        {/* Tab bar with underline indicator */}
        <div className="sticky top-[3.75rem] z-10 -mx-4 border-b border-border bg-bg/95 px-4 backdrop-blur-md">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {EVENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "flex-shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted hover:text-text"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {serverError && (
          <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {serverError}
          </p>
        )}

        {/* RESUMEN */}
        {activeTab === "resumen" && (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
                    Estado de la misión
                  </p>
                  <StatusBadge status={event?.status} className="mt-1">
                    {event?.status}
                  </StatusBadge>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12">
                  <span
                    className="material-symbols-outlined text-[1.4rem] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    target
                  </span>
                </div>
              </div>

              {priceGoal > 0 && (
                <ProgressBar
                  label="Financiamiento"
                  rightLabel={`${formatCurrency(totalExpenses)} / ${formatCurrency(priceGoal)}`}
                  value={fundingPct}
                />
              )}
            </Card>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
                  Agentes activos
                </p>
                <span className="text-xs font-semibold text-primary">{participants.length}</span>
              </div>
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card"
                >
                  <Avatar
                    name={p.profiles?.display_name}
                    url={p.profiles?.avatar_url}
                    className="size-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">
                      {p.profiles?.display_name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.15em] text-text-muted">{p.role}</p>
                  </div>
                  <div className="flex size-7 items-center justify-center rounded-full bg-success/15">
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
        )}

        {/* REGALO */}
        {activeTab === "regalo" && (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-text">Proponer regalo</h3>
                <p className="text-sm text-text-muted">
                  Idea nueva o referencia de la wishlist del cumpleañero.
                </p>
              </div>
              <form className="space-y-4" onSubmit={submitGift}>
                <FormField label="Título">
                  <Input
                    value={giftForm.title}
                    onChange={(e) => setGiftForm((c) => ({ ...c, title: e.target.value }))}
                  />
                </FormField>
                <FormField label="Link">
                  <Input
                    value={giftForm.url}
                    onChange={(e) => setGiftForm((c) => ({ ...c, url: e.target.value }))}
                  />
                </FormField>
                <FormField label="Precio estimado">
                  <Input
                    type="number"
                    value={giftForm.price_estimate}
                    onChange={(e) =>
                      setGiftForm((c) => ({ ...c, price_estimate: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Nota">
                  <TextArea
                    rows={2}
                    value={giftForm.notes}
                    onChange={(e) => setGiftForm((c) => ({ ...c, notes: e.target.value }))}
                  />
                </FormField>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={giftMutation.isPending || !giftForm.title.trim()}
                >
                  {giftMutation.isPending ? "Guardando..." : "Agregar propuesta"}
                </Button>
              </form>
            </Card>

            {gifts.length === 0 ? (
              <EmptyState
                icon="redeem"
                title="Sin propuestas todavía"
                description="Agrega la primera opción de regalo para este evento."
              />
            ) : (
              gifts.map((gift) => (
                <Card key={gift.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-text">{gift.title}</p>
                      {gift.price_estimate ? (
                        <p className="text-sm font-semibold text-primary-strong">
                          {formatCurrency(gift.price_estimate)}
                        </p>
                      ) : null}
                      {gift.notes ? (
                        <p className="text-sm text-text-muted">{gift.notes}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={gift.status}>{gift.status}</StatusBadge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        giftStatusMutation.mutate({ giftId: gift.id, status: "reserved" })
                      }
                    >
                      Reservar
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        giftStatusMutation.mutate({ giftId: gift.id, status: "bought" })
                      }
                    >
                      Marcar comprado
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() =>
                        giftStatusMutation.mutate({ giftId: gift.id, status: "discarded" })
                      }
                    >
                      Descartar
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* GASTOS */}
        {activeTab === "gastos" && (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-text">Registrar gasto</h3>
                <p className="text-sm text-text-muted">
                  Cada gasto genera shares para los participantes seleccionados.
                </p>
              </div>
              <form className="space-y-4" onSubmit={submitExpense}>
                <FormField label="Concepto">
                  <Input
                    value={expenseForm.title}
                    onChange={(e) =>
                      setExpenseForm((c) => ({ ...c, title: e.target.value }))
                    }
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Categoría">
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
                  <FormField label="Monto">
                    <Input
                      type="number"
                      value={expenseForm.amount}
                      onChange={(e) =>
                        setExpenseForm((c) => ({ ...c, amount: e.target.value }))
                      }
                    />
                  </FormField>
                </div>
                <FormField label="Método de reembolso">
                  <Select
                    value={expenseForm.reimbursement_destination_id}
                    onChange={(e) =>
                      setExpenseForm((c) => ({
                        ...c,
                        reimbursement_destination_id: e.target.value
                      }))
                    }
                  >
                    <option value="">Sin método asociado</option>
                    {paymentQuery.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label || item.type}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text">Participantes del split</p>
                  {participants.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selectedParticipants.includes(p.user_id)}
                        onChange={() => toggleParticipant(p.user_id)}
                      />
                      <span>{p.profiles?.display_name}</span>
                    </label>
                  ))}
                </div>
                <FormField label="Comprobante (opcional)">
                  <Input
                    type="file"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                </FormField>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={
                    expenseMutation.isPending || !expenseForm.title.trim() || !expenseForm.amount
                  }
                >
                  {expenseMutation.isPending ? "Guardando gasto..." : "Registrar gasto"}
                </Button>
              </form>
            </Card>

            {expenses.length === 0 ? (
              <EmptyState
                icon="payments"
                title="Sin gastos todavía"
                description="Registra el primero para repartir costos y generar shares."
              />
            ) : (
              expenses.map((expense) => (
                <Card key={expense.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-text">{expense.title}</p>
                      <p className="text-xs uppercase tracking-[0.15em] text-text-muted">
                        {expense.category}
                      </p>
                    </div>
                    <p className="text-base font-bold text-primary-strong">
                      {formatCurrency(expense.amount)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface-muted px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
                      Shares
                    </p>
                    <div className="space-y-2">
                      {(expense.shares || []).map((share) => (
                        <div key={share.id} className="flex items-center justify-between text-sm">
                          <span className="text-text-muted">
                            {share.user_id === user?.id ? "Tu parte" : share.user_id}
                          </span>
                          <span className="font-semibold text-text">
                            {formatCurrency(share.amount_due)} · {share.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* PAGOS */}
        {activeTab === "pagos" && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="text-lg font-bold text-text">Tus shares</h3>
              {myShares.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No tienes shares pendientes en este evento.
                </p>
              ) : (
                myShares.map((share) => (
                  <Link
                    key={share.id}
                    to={`/shares/${share.id}`}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-text">{share.expense.title}</p>
                      <p className="text-sm text-text-muted">{share.status}</p>
                    </div>
                    <p className="text-sm font-bold text-primary-strong">
                      {formatCurrency(share.amount_due)}
                    </p>
                  </Link>
                ))
              )}
            </Card>

            <Card className="space-y-3">
              <h3 className="text-lg font-bold text-text">Pagos por revisar</h3>
              {sharesToReview.length === 0 ? (
                <p className="text-sm text-text-muted">Aún no tienes pagos por confirmar.</p>
              ) : (
                sharesToReview.map((share) => (
                  <div key={share.id} className="space-y-3 rounded-2xl bg-surface-muted px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">{share.expense.title}</p>
                        <p className="text-sm text-text-muted">Estado: {share.status}</p>
                      </div>
                      <p className="text-sm font-bold text-primary-strong">
                        {formatCurrency(share.amount_due)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() =>
                          reviewMutation.mutate({ shareId: share.id, action: "confirmed" })
                        }
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={() =>
                          reviewMutation.mutate({ shareId: share.id, action: "rejected" })
                        }
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        )}

        {/* ACTIVIDAD */}
        {activeTab === "actividad" && (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState
                icon="history"
                title="Sin actividad todavía"
                description="Las acciones de regalo, gastos y pagos aparecerán aquí."
              />
            ) : (
              activity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card"
                >
                  <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/12">
                    <span
                      className="material-symbols-outlined text-[1rem] text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      history
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{entry.action_type}</p>
                    <p className="text-xs text-text-muted">
                      {formatDate(entry.created_at, {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
