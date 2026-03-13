export const EVENT_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

export const GIFT_STATUS = {
  PROPOSED: "proposed",
  RESERVED: "reserved",
  BOUGHT: "bought",
  DISCARDED: "discarded"
};

export const SHARE_STATUS = {
  PENDING: "pending",
  REPORTED_PAID: "reported_paid",
  CONFIRMED: "confirmed",
  REJECTED: "rejected"
};

export const EXPENSE_CATEGORIES = [
  { value: "gift", label: "Regalo" },
  { value: "cake", label: "Pastel" },
  { value: "decoration", label: "Decoracion" },
  { value: "snacks", label: "Snacks" },
  { value: "other", label: "Otro" }
];

export const PAYMENT_DESTINATION_TYPES = [
  { value: "clabe", label: "CLABE" },
  { value: "card", label: "Tarjeta" },
  { value: "account", label: "Cuenta" },
  { value: "alias", label: "Alias o referencia" },
  { value: "other", label: "Otro" }
];

export const EVENT_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "regalo", label: "Regalo" },
  { id: "gastos", label: "Gastos" },
  { id: "pagos", label: "Pagos" },
  { id: "actividad", label: "Actividad" }
];
