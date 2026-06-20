export async function suggestGifts(context) {
  const res = await fetch("/api/ai/suggest-gifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al obtener sugerencias");
  }
  return res.json();
}

export async function parseExpense(text, participants) {
  const res = await fetch("/api/ai/parse-expense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, participants })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al analizar el gasto");
  }
  return res.json();
}

export async function getActivitySummary(context) {
  const res = await fetch("/api/ai/activity-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al generar resumen");
  }
  return res.json();
}
