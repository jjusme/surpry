import { requireSupabase } from "../../lib/supabase";

export async function listMyWishlist(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveWishlistItem(userId, values) {
  const supabase = requireSupabase();
  const payload = {
    user_id: userId,
    title: values.title,
    url: values.url || null,
    notes: values.notes || null,
    price_estimate: values.price_estimate ? Number(values.price_estimate) : null,
    priority: values.priority || null
  };

  let query = supabase.from("wishlist_items");

  if (values.id) {
    query = query.update(payload).eq("id", values.id);
  } else {
    query = query.insert(payload);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWishlistItem(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("wishlist_items").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
