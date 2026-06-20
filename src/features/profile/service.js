import { requireSupabase } from "../../lib/supabase";

export async function getMyProfile(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, values) {
  const supabase = requireSupabase();
  const payload = {
    id: userId,
    display_name: values.display_name || "",
    birthday_day: values.birthday_day || null,
    birthday_month: values.birthday_month || null,
    avatar_url: values.avatar_url || null,
    bio: values.bio || null,
    shirt_size: values.shirt_size || null,
    shoe_size: values.shoe_size || null,
    pants_size: values.pants_size || null,
    clothing_style: values.clothing_style || null,
    favorite_colors: values.favorite_colors?.length ? values.favorite_colors : null,
    favorite_brands: values.favorite_brands?.length ? values.favorite_brands : null,
    hobbies: values.hobbies?.length ? values.hobbies : null,
    dietary_restrictions: values.dietary_restrictions?.length ? values.dietary_restrictions : null,
    dislikes: values.dislikes?.length ? values.dislikes : null,
    social_instagram: values.social_instagram || null,
    social_tiktok: values.social_tiktok || null,
    has_completed_setup: values.has_completed_setup ?? true
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getProfileById(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listPaymentDestinations(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("payment_destinations")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function savePaymentDestination(userId, values) {
  const supabase = requireSupabase();

  if (values.is_default) {
    await supabase
      .from("payment_destinations")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const payload = {
    user_id: userId,
    type: values.type,
    label: values.label || null,
    bank_name: values.bank_name || null,
    account_holder: values.account_holder || null,
    destination_value: values.destination_value,
    note: values.note || null,
    is_default: Boolean(values.is_default)
  };

  let query = supabase.from("payment_destinations");

  if (values.id) {
    query = query.update(payload).eq("id", values.id);
  } else {
    query = query.insert(payload);
  }

  const { data, error } = await query.select("*").single();

  if (error) throw error;
  return data;
}

export async function deletePaymentDestination(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("payment_destinations").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadAvatar(userId, file) {
  const supabase = requireSupabase();
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function listDontWant(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("wish_dont_want")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addDontWant(userId, title, reason) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("wish_dont_want")
    .insert({ user_id: userId, title, reason: reason || null })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDontWant(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("wish_dont_want").delete().eq("id", id);
  if (error) throw error;
}

export async function getGiftHistory(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("gift_history")
    .select("*")
    .eq("recipient_id", userId)
    .order("year", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
