import { daysUntilDate } from "./format";

function getEventCopy(eventType) {
  if (eventType === "gathering") {
    return {
      typeLabel: "Convivio",
      upcomingDraft: "Todavía están armando el convivio.",
      upcomingActive: "El convivio ya está en marcha.",
      todayDraft: "Hoy es la fecha y todavía faltan ajustes.",
      todayActive: "Hoy toca disfrutar el convivio.",
      pastDue: "El convivio ya pasó; falta cerrar pendientes.",
      completed: "Todo quedó cerrado después del convivio.",
      cancelled: "Este convivio fue cancelado.",
      listDraft: "Ajustando detalles del convivio",
      listActive: "Equipo organizando el convivio",
      listPastDue: "La fecha ya pasó; falta cerrarlo",
      listCompleted: "Convivio cerrado",
      listCancelled: "Convivio cancelado",
      statusHeading: "Estado del convivio",
      todayLabel: "Hoy es el convivio",
      passedLabel: "El convivio ya pasó",
      completedLabel: "Convivio cerrado",
      cancelledLabel: "Convivio cancelado",
      pendingNote: "La fecha ya pasó y conviene revisar gastos, tareas o confirmaciones pendientes."
    };
  }

  return {
    typeLabel: "Cumpleaños",
    upcomingDraft: "Todavía están armando la sorpresa.",
    upcomingActive: "La sorpresa ya está en marcha.",
    todayDraft: "Hoy es la fecha y todavía faltan ajustes.",
    todayActive: "Hoy es el gran día.",
    pastDue: "El cumpleaños ya pasó; falta cerrar pendientes.",
    completed: "La sorpresa ya quedó cerrada.",
    cancelled: "Este plan fue cancelado.",
    listDraft: "Sorpresa en preparación",
    listActive: "Plan en marcha",
    listPastDue: "La fecha ya pasó; falta cerrarlo",
    listCompleted: "Plan cerrado",
    listCancelled: "Plan cancelado",
    statusHeading: "Estado del plan",
    todayLabel: "Hoy es su cumpleaños",
    passedLabel: "El cumpleaños ya pasó",
    completedLabel: "Plan cerrado",
    cancelledLabel: "Plan cancelado",
    pendingNote: "La fecha ya pasó y conviene revisar regalos, gastos o tareas pendientes."
  };
}

export function getEventState(event, baseDate = new Date()) {
  const eventType = event?.event_type === "gathering" ? "gathering" : "birthday";
  const copy = getEventCopy(eventType);
  const rawStatus = event?.status || "draft";
  const daysUntilEvent = daysUntilDate(event?.birthday_date, baseDate);
  const isToday = daysUntilEvent === 0;
  const isPast = typeof daysUntilEvent === "number" && daysUntilEvent < 0;
  const isCompleted = rawStatus === "completed";
  const isCancelled = rawStatus === "cancelled";
  const needsClosure = isPast && !isCompleted && !isCancelled;
  const displayStatus = needsClosure ? "past_due" : rawStatus;
  const badgeLabel = needsClosure ? "Pendiente cierre" : undefined;

  let heroMessage = copy.upcomingDraft;
  let listHint = copy.listDraft;
  let statusNote = "Todavía no hay suficiente actividad para abrirlo formalmente.";

  if (isCancelled) {
    heroMessage = copy.cancelled;
    listHint = copy.listCancelled;
    statusNote = "Este evento ya no requiere seguimiento adicional.";
  } else if (isCompleted) {
    heroMessage = copy.completed;
    listHint = copy.listCompleted;
    statusNote = "Todo quedó registrado y ya no hay acciones pendientes.";
  } else if (needsClosure) {
    heroMessage = copy.pastDue;
    listHint = copy.listPastDue;
    statusNote = copy.pendingNote;
  } else if (rawStatus === "active") {
    heroMessage = isToday ? copy.todayActive : copy.upcomingActive;
    listHint = copy.listActive;
    statusNote = "El plan sigue abierto y el grupo ya está colaborando activamente.";
  } else if (rawStatus === "draft" && isToday) {
    heroMessage = copy.todayDraft;
  }

  let timingLabel = "Sin fecha";
  if (typeof daysUntilEvent === "number") {
    if (daysUntilEvent === 0) {
      timingLabel = "Hoy";
    } else if (daysUntilEvent === 1) {
      timingLabel = "Mañana";
    } else if (daysUntilEvent < 0) {
      timingLabel = "Ya pasó";
    } else {
      timingLabel = `En ${daysUntilEvent} días`;
    }
  }

  return {
    daysUntilEvent,
    isToday,
    isPast,
    needsClosure,
    displayStatus,
    badgeLabel,
    heroMessage,
    listHint,
    statusNote,
    statusHeading: copy.statusHeading,
    typeLabel: copy.typeLabel,
    timingLabel,
    todayLabel: copy.todayLabel,
    passedLabel: isCompleted ? copy.completedLabel : isCancelled ? copy.cancelledLabel : copy.passedLabel,
    canComplete: !isCancelled && !isCompleted && (rawStatus === "active" || needsClosure)
  };
}
