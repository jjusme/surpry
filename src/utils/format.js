const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseLocalDate(dateLike) {
  if (!dateLike) {
    return null;
  }

  if (dateLike instanceof Date) {
    return new Date(dateLike);
  }

  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    const [year, month, day] = dateLike.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateLike);
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function startOfLocalDay(dateLike = new Date()) {
  const date = parseLocalDate(dateLike);
  if (!isValidDate(date)) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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

  const date = parseLocalDate(dateString);
  if (!isValidDate(date)) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-MX", {
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

export function daysUntilDate(targetDate, baseDate = new Date()) {
  const target = startOfLocalDay(targetDate);
  const base = startOfLocalDay(baseDate);

  if (!target || !base) {
    return null;
  }

  return Math.round((target.getTime() - base.getTime()) / DAY_IN_MS);
}

export function daysUntilBirthday(day, month, baseDate = new Date()) {
  if (!day || !month) {
    return null;
  }

  const today = startOfLocalDay(baseDate);
  if (!today) {
    return null;
  }

  const year = today.getFullYear();
  let nextBirthday = new Date(year, month - 1, day);

  if (nextBirthday < today) {
    nextBirthday = new Date(year + 1, month - 1, day);
  }

  return daysUntilDate(nextBirthday, today);
}

export function getBirthdayCountdownLabel(days, { short = false } = {}) {
  if (days === null || days === undefined) {
    return "Sin fecha";
  }

  if (days === 0) {
    return "Hoy";
  }

  if (days === 1) {
    return "Mañana";
  }

  return short ? `${days}d` : `En ${days} días`;
}

export function getBirthdaySectionLabel(days) {
  if (days === 0) {
    return "Hoy";
  }

  if (days === 1) {
    return "Mañana";
  }

  if (days <= 7) {
    return "Esta semana";
  }

  if (days <= 30) {
    return "Próximamente";
  }

  return "Más adelante";
}
