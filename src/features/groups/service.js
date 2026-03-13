import { requireSupabase } from "../../lib/supabase";

function createInviteToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function listGroups(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
        role,
        group_id,
        groups (
          id,
          name,
          photo_url,
          auto_create_days_before,
          created_at
        )
      `
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => ({
    ...entry.groups,
    membership_role: entry.role
  }));
}

export async function createGroup(userId, values) {
  const supabase = requireSupabase();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name: values.name,
      photo_url: values.photo_url || null,
      created_by: userId,
      auto_create_days_before: values.auto_create_days_before || 30
    })
    .select("*")
    .single();

  if (groupError) {
    throw groupError;
  }

  const { error: memberError } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: userId,
    role: "admin"
  });

  if (memberError) {
    throw memberError;
  }

  return group;
}

export async function getGroupDetail(groupId) {
  const supabase = requireSupabase();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw groupError;
  }

  const [membersResult, eventsResult] = await Promise.all([
    supabase
      .from("group_members")
      .select(
        `
          role,
          user_id,
          joined_at,
          profiles (
            id,
            display_name,
            avatar_url,
            birthday_day,
            birthday_month
          )
        `
      )
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("birthday_events")
      .select(
        `
          *,
          birthday_profile:profiles!birthday_events_birthday_user_id_fkey (
            id,
            display_name,
            avatar_url,
            birthday_day,
            birthday_month
          )
        `
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
  ]);

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (eventsResult.error) {
    throw eventsResult.error;
  }

  return {
    group,
    members: membersResult.data ?? [],
    events: eventsResult.data ?? []
  };
}

export async function createGroupInvite(groupId, createdBy) {
  const supabase = requireSupabase();
  const token = createInviteToken();
  const { data, error } = await supabase
    .from("group_invites")
    .insert({
      group_id: groupId,
      created_by: createdBy,
      token
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getInviteByToken(token) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("group_invites")
    .select(
      `
        id,
        token,
        revoked_at,
        created_at,
        groups (
          id,
          name,
          photo_url
        )
      `
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function acceptInvite(token) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("accept_group_invite", {
    p_token: token
  });

  if (error) {
    throw error;
  }

  return data;
}
