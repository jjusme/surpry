import { requireSupabase } from "../../lib/supabase";

export async function getMyProfile(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertProfile(userId, values) {
  const supabase = requireSupabase();
  const payload = {
    id: userId,
    display_name: values.display_name,
    birthday_day: values.birthday_day || null,
    birthday_month: values.birthday_month || null,
    avatar_url: values.avatar_url || null
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  return data;
}

export async function deletePaymentDestination(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("payment_destinations").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function uploadAvatar(userId, file) {
  const supabase = requireSupabase();
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
