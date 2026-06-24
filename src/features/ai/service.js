import { requireSupabase } from "../../lib/supabase";

async function authHeaders() {
  const supabase = requireSupabase();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function suggestGifts(context) {
  const res = await fetch("/api/ai/suggest-gifts", {
    method: "POST",
    headers: await authHeaders(),
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
    headers: await authHeaders(),
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
    headers: await authHeaders(),
    body: JSON.stringify(context)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al generar resumen");
  }
  return res.json();
}
