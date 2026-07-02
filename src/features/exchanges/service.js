import { requireSupabase } from "../../lib/supabase";

export async function listMyExchanges(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("exchange_participants")
    .select(`
      gift_exchanges (
        id, name, status, budget, exchange_date, group_id, created_by,
        groups (id, name),
        participants:exchange_participants(count)
      )
    `)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error) throw error;
  return (data ?? [])
    .map((row) => row.gift_exchanges)
    .filter(Boolean)
    .map((ex) => ({
      ...ex,
      participant_count: ex.participants?.[0]?.count ?? 0
    }));
}

export async function listGroupExchanges(groupId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("gift_exchanges")
    .select("*, participants:exchange_participants(count)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((ex) => ({
    ...ex,
    participant_count: ex.participants?.[0]?.count ?? 0
  }));
}

export async function getExchange(exchangeId) {
  const supabase = requireSupabase();

  const [exchangeRes, participantsRes, exclusionsRes] = await Promise.all([
    supabase.from("gift_exchanges").select("*").eq("id", exchangeId).single(),
    supabase
      .from("exchange_participants")
      .select("*, profiles(id, display_name, avatar_url)")
      .eq("exchange_id", exchangeId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("exchange_exclusions")
      .select("id, user_a, user_b, a:profiles!user_a(id, display_name), b:profiles!user_b(id, display_name)")
      .eq("exchange_id", exchangeId)
  ]);

  if (exchangeRes.error) throw exchangeRes.error;
  if (participantsRes.error) throw participantsRes.error;
  if (exclusionsRes.error) throw exclusionsRes.error;

  return {
    exchange: exchangeRes.data,
    participants: participantsRes.data ?? [],
    exclusions: exclusionsRes.data ?? []
  };
}

export async function getMyAssignment(exchangeId, userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("exchange_assignments")
    .select("id, receiver:profiles!receiver_id(id, display_name, avatar_url)")
    .eq("exchange_id", exchangeId)
    .eq("giver_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.receiver ?? null;
}

export async function createExchange(values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_gift_exchange", {
    p_group_id: values.group_id,
    p_name: values.name,
    p_budget: values.budget ? Number(values.budget) : null,
    p_exchange_date: values.exchange_date || null,
    p_description: values.description || null
  });
  if (error) throw error;
  return data;
}

export async function updateExchange(exchangeId, values) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("gift_exchanges")
    .update({
      name: values.name,
      budget: values.budget ? Number(values.budget) : null,
      exchange_date: values.exchange_date || null,
      description: values.description || null
    })
    .eq("id", exchangeId);
  if (error) throw error;
}

export async function joinExchange(exchangeId, userId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("exchange_participants")
    .insert({ exchange_id: exchangeId, user_id: userId });
  if (error) throw error;
}

export async function leaveExchange(exchangeId, userId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("exchange_participants")
    .delete()
    .eq("exchange_id", exchangeId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setPurchased(exchangeId, userId, value) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("exchange_participants")
    .update({ has_purchased: value })
    .eq("exchange_id", exchangeId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function addExclusion(exchangeId, userA, userB) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("exchange_exclusions")
    .insert({ exchange_id: exchangeId, user_a: userA, user_b: userB });
  if (error) throw error;
}

export async function removeExclusion(exclusionId) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("exchange_exclusions").delete().eq("id", exclusionId);
  if (error) throw error;
}

export async function drawExchange(exchangeId) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("draw_gift_exchange", { p_exchange_id: exchangeId });
  if (error) throw error;
}

export async function resetExchange(exchangeId) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("reset_gift_exchange", { p_exchange_id: exchangeId });
  if (error) throw error;
}

export async function closeExchange(exchangeId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("gift_exchanges")
    .update({ status: "closed" })
    .eq("id", exchangeId);
  if (error) throw error;
}

export async function deleteExchange(exchangeId) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("gift_exchanges").delete().eq("id", exchangeId);
  if (error) throw error;
}
