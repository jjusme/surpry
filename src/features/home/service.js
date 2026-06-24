import { requireSupabase } from "../../lib/supabase";

export async function getPendingShares(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("expense_shares")
    .select(`*, expenses (id, title, amount, event_id)`)
    .eq("user_id", userId)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

export async function getReportedShares(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("expense_shares")
    .select(`*, expenses (id, title, amount, event_id)`)
    .eq("user_id", userId)
    .eq("status", "reported_paid")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadNotifications(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

export async function listManualBirthdays(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("manual_birthdays")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
