export function formatCurrency(amount = 0, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export function formatBirthday(day, month) {
  if (!day || !month) {
    return "Sin fecha";
  }

  const date = new Date(2000, month - 1, day);

  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long"
  });
}

export function formatDate(dateString, options = {}) {
  if (!dateString) {
    return "Sin fecha";
  }

  return new Date(dateString).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options
  });
}

export function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");
}

export function daysUntilBirthday(day, month) {
  if (!day || !month) return null;
  const today = new Date();
  const year = today.getFullYear();
  let next = new Date(year, month - 1, day);
  if (next < today) next = new Date(year + 1, month - 1, day);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}
