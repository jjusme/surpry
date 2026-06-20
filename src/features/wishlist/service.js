import { requireSupabase } from "../../lib/supabase";

export async function listMyWishlist(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("is_fulfilled", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
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
    priority: values.priority || "media",
    image_url: values.image_url || null,
    category: values.category || null,
    size: values.size || null,
    color_preference: values.color_preference || null,
    store_name: values.store_name || null,
    is_fulfilled: values.is_fulfilled ?? false
  };

  let query = supabase.from("wishlist_items");

  if (values.id) {
    query = query.update(payload).eq("id", values.id);
  } else {
    query = query.insert(payload);
  }

  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteWishlistItem(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFulfilled(id, isFulfilled) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("wishlist_items")
    .update({ is_fulfilled: isFulfilled })
    .eq("id", id);
  if (error) throw error;
}
