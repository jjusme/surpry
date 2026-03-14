import { requireSupabase } from "../../lib/supabase";

export async function listEvents(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("event_participants")
    .select(
      `
        role,
        birthday_events (
          id,
          group_id,
          birthday_user_id,
          organizer_id,
          birthday_date,
          event_year,
          auto_created,
          status,
          created_at,
          groups (
            id,
            name
          ),
          birthday_profile:profiles!birthday_events_birthday_user_id_fkey (
            id,
            display_name,
            avatar_url
          ),
          participants:event_participants (
            user_id,
            role,
            profiles (
              id,
              display_name,
              avatar_url
            )
          )
        )
      `
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => ({
    ...entry.birthday_events,
    participant_role: entry.role
  }));
}

export async function createEvent(groupId, birthdayUserId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_manual_birthday_event", {
    p_group_id: groupId,
    p_birthday_user_id: birthdayUserId
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getEventDetail(eventId) {
  const supabase = requireSupabase();
  const { data: event, error: eventError } = await supabase
    .from("birthday_events")
    .select(
      `
        *,
        groups (
          id,
          name
        ),
        birthday_profile:profiles!birthday_events_birthday_user_id_fkey (
          id,
          display_name,
          avatar_url,
          birthday_day,
          birthday_month
        )
      `
    )
    .eq("id", eventId)
    .single();

  if (eventError) {
    throw eventError;
  }

  const [participantsResult, giftsResult, expensesResult, activityResult] = await Promise.all([
    supabase
      .from("event_participants")
      .select(
        `
          *,
          profiles (
            id,
            display_name,
            avatar_url
          )
        `
      )
      .eq("event_id", eventId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("gift_options")
      .select("*, profiles!gift_options_proposed_by_fkey(display_name, avatar_url)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("expenses")
      .select(
        `
          *,
          shares:expense_shares (*)
        `
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
  ]);

  if (participantsResult.error) {
    throw participantsResult.error;
  }
  if (giftsResult.error) {
    throw giftsResult.error;
  }
  if (expensesResult.error) {
    throw expensesResult.error;
  }
  if (activityResult.error) {
    throw activityResult.error;
  }

  return {
    event,
    participants: participantsResult.data ?? [],
    gifts: giftsResult.data ?? [],
    expenses: expensesResult.data ?? [],
    activity: activityResult.data ?? []
  };
}

export async function addGiftOption(eventId, values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("gift_options")
    .insert({
      event_id: eventId,
      source_type: values.source_type || "manual",
      wishlist_item_id: values.wishlist_item_id || null,
      title: values.title,
      url: values.url || null,
      notes: values.notes || null,
      price_estimate: values.price_estimate ? Number(values.price_estimate) : null,
      proposed_by: values.proposed_by,
      status: "proposed"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await appendActivity(eventId, values.proposed_by, "gift_option_created", "gift_option", data.id, {
    title: data.title
  });

  return data;
}

export async function updateGiftStatus(eventId, giftId, status, actingUserId) {
  const supabase = requireSupabase();
  const payload = {
    status,
    bought_by_user_id: status === "bought" ? actingUserId : null
  };

  const { data, error } = await supabase
    .from("gift_options")
    .update(payload)
    .eq("id", giftId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await activateEventIfDraft(eventId);
  await appendActivity(eventId, actingUserId, "gift_option_status_changed", "gift_option", giftId, {
    status
  });

  return data;
}

export async function createExpenseWithShares(values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_expense_with_shares", {
    p_event_id: values.event_id,
    p_title: values.title,
    p_description: values.description || null,
    p_category: values.category,
    p_amount: Number(values.amount),
    p_paid_by_user_id: values.paid_by_user_id,
    p_reimbursement_destination_id: values.reimbursement_destination_id || null,
    p_receipt_path: values.receipt_path || null,
    p_participant_ids: values.participant_ids
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getShareDetail(shareId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("get_share_payment_details", {
    p_share_id: shareId
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function reportSharePaid(shareId, values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("report_share_payment", {
    p_share_id: shareId,
    p_note: values.note || null,
    p_proof_path: values.proof_path || null
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function reviewShare(shareId, action) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("set_share_review", {
    p_share_id: shareId,
    p_action: action
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function syncEventWishlist(eventId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("sync_event_wishlist", {
    p_event_id: eventId
  });

  if (error) {
    throw error;
  }

  return data;
}
export async function uploadPrivateFile(bucket, path, file) {
  const supabase = requireSupabase();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false
  });

  if (error) {
    throw error;
  }

  return path;
}

async function activateEventIfDraft(eventId) {
  const supabase = requireSupabase();
  await supabase
    .from("birthday_events")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("status", "draft");
}

async function appendActivity(eventId, actorUserId, actionType, targetType, targetId, metadata) {
  const supabase = requireSupabase();
  await supabase.from("activity_logs").insert({
    event_id: eventId,
    actor_user_id: actorUserId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    metadata
  });
}

export async function listEventMessages(eventId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("event_messages")
    .select(`
      *,
      profiles (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function sendEventMessage(eventId, message, userId) {
  if (!message || message.trim() === "") return;
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("event_messages")
    .insert({
      event_id: eventId,
      user_id: userId,
      message: message.trim()
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteEvent(eventId) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("delete_event", {
    p_event_id: eventId
  });

  if (error) {
    throw error;
  }
}
