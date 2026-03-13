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

const initialGiftForm = {
  title: "",
  url: "",
  price_estimate: "",
  notes: ""
};

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    },
    onError: (error) => setServerError(error.message)
  });

  const participants = detailQuery.data?.participants || [];
  const gifts = detailQuery.data?.gifts || [];
  const expenses = detailQuery.data?.expenses || [];
  const activity = detailQuery.data?.activity || [];
  const event = detailQuery.data?.event;

  const myShares = useMemo(
    () => expenses.flatMap((expense) => (expense.shares || []).filter((share) => share.user_id === user?.id).map((share) => ({ ...share, expense }))),
    [expenses, user?.id]
  );

  const sharesToReview = useMemo(
    () => expenses.flatMap((expense) => (expense.shares || []).filter((share) => expense.paid_by_user_id === user?.id && share.user_id !== user?.id).map((share) => ({ ...share, expense }))),
    [expenses, user?.id]
  );

  const totalExpenses = expenses.reduce((acc, expense) => acc + Number(expense.amount || 0), 0);

  const toggleParticipant = (participantId) => {
    setSelectedParticipants((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  };

  const submitGift = async (eventSubmit) => {
    eventSubmit.preventDefault();
    setServerError("");
    await giftMutation.mutateAsync({ ...giftForm, proposed_by: user.id });
  };

  const submitExpense = async (eventSubmit) => {
    eventSubmit.preventDefault();
    setServerError("");
    if (selectedParticipants.length === 0) {
      setServerError("Selecciona al menos un participante para dividir el gasto.");
      return;
    }

    await expenseMutation.mutateAsync({
      ...expenseForm,
      participant_ids: selectedParticipants
    });
  };

  if (detailQuery.isLoading || paymentQuery.isLoading) {
    return <LoadingState message="Cargando evento..." fullScreen />;
  }

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
      header={<PageHeader title={event?.birthday_profile?.display_name || "Evento secreto"} subtitle="Operacion" backTo="/eventos" />}
    >
      <div className="space-y-4 pt-4">
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={event?.birthday_profile?.display_name} url={event?.birthday_profile?.avatar_url} className="size-20 text-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-muted">Grupo: {event?.groups?.name}</p>
              <h2 className="text-2xl font-bold text-text">{event?.birthday_profile?.display_name}</h2>
              <p className="text-sm text-text-muted">Fecha objetivo: {formatDate(event?.birthday_date, { day: "numeric", month: "long" })}</p>
            </div>
            <StatusBadge status={event?.status}>{event?.status}</StatusBadge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-muted px-4 py-3">
              <p className="text-sm text-text-muted">Participantes</p>
              <p className="text-xl font-bold text-text">{participants.length}</p>
            </div>
            <div className="rounded-2xl bg-surface-muted px-4 py-3">
              <p className="text-sm text-text-muted">Gastos</p>
              <p className="text-xl font-bold text-text">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>
        </Card>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {EVENT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-primary text-slate-950" : "bg-surface text-text-muted"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {serverError ? <p className="text-sm font-medium text-danger">{serverError}</p> : null}

        {activeTab === "resumen" ? (
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="text-lg font-bold text-text">Participantes</h3>
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={participant.profiles?.display_name} url={participant.profiles?.avatar_url} />
                    <div>
                      <p className="text-sm font-semibold text-text">{participant.profiles?.display_name}</p>
                      <p className="text-sm text-text-muted">{participant.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
            <Card className="space-y-3">
              <h3 className="text-lg font-bold text-text">Resumen financiero</h3>
              <p className="text-sm text-text-muted">Registra varios gastos; Surpry divide shares en partes iguales por los participantes seleccionados.</p>
            </Card>
          </div>
        ) : null}

        {activeTab === "regalo" ? (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-text">Proponer regalo</h3>
                <p className="text-sm text-text-muted">Puedes traer una idea nueva o tomar referencia de la wishlist del cumpleanero.</p>
              </div>
              <form className="space-y-4" onSubmit={submitGift}>
                <FormField label="Titulo">
                  <Input value={giftForm.title} onChange={(event) => setGiftForm((current) => ({ ...current, title: event.target.value }))} />
                </FormField>
                <FormField label="Link">
                  <Input value={giftForm.url} onChange={(event) => setGiftForm((current) => ({ ...current, url: event.target.value }))} />
                </FormField>
                <FormField label="Precio estimado">
                  <Input type="number" value={giftForm.price_estimate} onChange={(event) => setGiftForm((current) => ({ ...current, price_estimate: event.target.value }))} />
                </FormField>
                <FormField label="Nota">
                  <TextArea rows={3} value={giftForm.notes} onChange={(event) => setGiftForm((current) => ({ ...current, notes: event.target.value }))} />
                </FormField>
                <Button type="submit" className="w-full" disabled={giftMutation.isPending || !giftForm.title.trim()}>
                  {giftMutation.isPending ? "Guardando..." : "Agregar propuesta"}
                </Button>
              </form>
            </Card>
            {gifts.length === 0 ? (
              <EmptyState icon="redeem" title="Aun no hay propuestas" description="Agrega la primera opcion de regalo para este evento." />
            ) : (
              gifts.map((gift) => (
                <Card key={gift.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-text">{gift.title}</p>
                      <p className="text-sm text-text-muted">{gift.notes || "Sin nota"}</p>
                      {gift.price_estimate ? <p className="text-sm font-semibold text-primary-strong">{formatCurrency(gift.price_estimate)}</p> : null}
                    </div>
                    <StatusBadge status={gift.status}>{gift.status}</StatusBadge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => giftStatusMutation.mutate({ giftId: gift.id, status: "reserved" })}>Reservar</Button>
                    <Button variant="secondary" onClick={() => giftStatusMutation.mutate({ giftId: gift.id, status: "bought" })}>Marcar comprado</Button>
                    <Button variant="ghost" onClick={() => giftStatusMutation.mutate({ giftId: gift.id, status: "discarded" })}>Descartar</Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "gastos" ? (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-text">Registrar gasto</h3>
                <p className="text-sm text-text-muted">Cada gasto crea sus propias shares para los participantes seleccionados.</p>
              </div>
              <form className="space-y-4" onSubmit={submitExpense}>
                <FormField label="Concepto">
                  <Input value={expenseForm.title} onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))} />
                </FormField>
                <FormField label="Descripcion">
                  <TextArea rows={2} value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Categoria">
                    <Select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Monto">
                    <Input type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Metodo para recibir reembolso">
                  <Select value={expenseForm.reimbursement_destination_id} onChange={(event) => setExpenseForm((current) => ({ ...current, reimbursement_destination_id: event.target.value }))}>
                    <option value="">Sin metodo asociado</option>
                    {paymentQuery.data.map((item) => (
                      <option key={item.id} value={item.id}>{item.label || item.type}</option>
                    ))}
                  </Select>
                </FormField>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text">Participantes del split</p>
                  <div className="grid grid-cols-1 gap-2">
                    {participants.map((participant) => (
                      <label key={participant.id} className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text">
                        <input type="checkbox" checked={selectedParticipants.includes(participant.user_id)} onChange={() => toggleParticipant(participant.user_id)} />
                        <span>{participant.profiles?.display_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <FormField label="Comprobante">
                  <Input type="file" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} />
                </FormField>
                <Button type="submit" className="w-full" disabled={expenseMutation.isPending || !expenseForm.title.trim() || !expenseForm.amount}>
                  {expenseMutation.isPending ? "Guardando gasto..." : "Registrar gasto"}
                </Button>
              </form>
            </Card>
            {expenses.length === 0 ? (
              <EmptyState icon="payments" title="Todavia no hay gastos" description="Registra el primero para repartir costos y generar shares." />
            ) : (
              expenses.map((expense) => (
                <Card key={expense.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-text">{expense.title}</p>
                      <p className="text-sm text-text-muted">{expense.category}</p>
                    </div>
                    <p className="text-base font-bold text-primary-strong">{formatCurrency(expense.amount)}</p>
                  </div>
                  {expense.description ? <p className="text-sm text-text-muted">{expense.description}</p> : null}
                  <div className="rounded-2xl bg-surface-muted px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Shares</p>
                    <div className="mt-2 space-y-2">
                      {(expense.shares || []).map((share) => (
                        <div key={share.id} className="flex items-center justify-between text-sm">
                          <span className="text-text-muted">{share.user_id === user?.id ? "Tu parte" : share.user_id}</span>
                          <span className="font-semibold text-text">{formatCurrency(share.amount_due)} · {share.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "pagos" ? (
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="text-lg font-bold text-text">Tus shares</h3>
              {myShares.length === 0 ? (
                <p className="text-sm text-text-muted">No tienes shares pendientes en este evento.</p>
              ) : (
                myShares.map((share) => (
                  <Link key={share.id} to={`/shares/${share.id}`} className="block rounded-2xl bg-surface-muted px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">{share.expense.title}</p>
                        <p className="text-sm text-text-muted">{share.status}</p>
                      </div>
                      <p className="text-sm font-bold text-primary-strong">{formatCurrency(share.amount_due)}</p>
                    </div>
                  </Link>
                ))
              )}
            </Card>
            <Card className="space-y-3">
              <h3 className="text-lg font-bold text-text">Pagos por revisar</h3>
              {sharesToReview.length === 0 ? (
                <p className="text-sm text-text-muted">Aun no tienes pagos por confirmar.</p>
              ) : (
                sharesToReview.map((share) => (
                  <div key={share.id} className="space-y-3 rounded-2xl bg-surface-muted px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">{share.expense.title}</p>
                        <p className="text-sm text-text-muted">Estado: {share.status}</p>
                      </div>
                      <p className="text-sm font-bold text-primary-strong">{formatCurrency(share.amount_due)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => reviewMutation.mutate({ shareId: share.id, action: "confirmed" })}>
                        Confirmar
                      </Button>
                      <Button variant="danger" className="flex-1" onClick={() => reviewMutation.mutate({ shareId: share.id, action: "rejected" })}>
                        Rechazar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        ) : null}

        {activeTab === "actividad" ? (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState icon="history" title="Sin actividad todavia" description="Las acciones de regalo, gastos y pagos apareceran aqui." />
            ) : (
              activity.map((entry) => (
                <Card key={entry.id} className="space-y-2">
                  <p className="text-sm font-semibold text-text">{entry.action_type}</p>
                  <p className="text-sm text-text-muted">{formatDate(entry.created_at, { hour: "2-digit", minute: "2-digit" })}</p>
                  {entry.metadata ? <pre className="overflow-x-auto rounded-2xl bg-surface-muted p-3 text-xs text-text-muted">{JSON.stringify(entry.metadata, null, 2)}</pre> : null}
                </Card>
              ))
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
