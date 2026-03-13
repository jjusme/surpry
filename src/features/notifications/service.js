import { requireSupabase } from "../../lib/supabase";

export async function listNotifications(userId) {
    const supabase = requireSupabase();
    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

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

export async function markAllNotificationsRead(userId) {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);

    if (error) throw error;
}
