-- =====================================================
-- SECURITY FIX MIGRATION
-- Restores access control lost during consolidation,
-- adds missing GRANTs, and restores business logic guards.
-- =====================================================

-- 1. RESTORE: get_share_payment_details access validation
-- Lost in 202603140001 — any authenticated user could read any share's payment details
CREATE OR REPLACE FUNCTION public.get_share_payment_details(p_share_id uuid)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  expense_title text,
  amount_due numeric,
  status text,
  destination_type text,
  destination_bank_name text,
  destination_account_holder text,
  destination_value text,
  destination_note text,
  can_review boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.expense_shares es
    JOIN public.expenses ex ON ex.id = es.expense_id
    JOIN public.birthday_events be ON be.id = ex.event_id
    WHERE es.id = p_share_id
      AND (
        es.user_id = auth.uid()
        OR ex.paid_by_user_id = auth.uid()
        OR be.organizer_id = auth.uid()
      )
  ) THEN
    RAISE EXCEPTION 'You cannot access this share';
  END IF;

  RETURN QUERY
  SELECT es.id,
         ex.event_id,
         ex.title,
         es.amount_due,
         es.status,
         pd.type,
         pd.bank_name,
         pd.account_holder,
         pd.destination_value,
         pd.note,
         (
           (ex.paid_by_user_id = auth.uid() OR be.organizer_id = auth.uid())
           AND es.status = 'reported_paid'
         ) AS can_review
  FROM public.expense_shares es
  JOIN public.expenses ex ON ex.id = es.expense_id
  JOIN public.birthday_events be ON be.id = ex.event_id
  LEFT JOIN public.payment_destinations pd ON pd.id = ex.reimbursement_destination_id
  WHERE es.id = p_share_id;
END;
$$;

-- 2. RESTORE: report_share_payment ownership check
-- Lost in 202603140006 — any user could report any share as paid
CREATE OR REPLACE FUNCTION public.report_share_payment(
  p_share_id uuid,
  p_note text DEFAULT NULL,
  p_proof_path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_expense_id uuid;
  v_collector_id uuid;
  v_amount numeric;
  v_expense_title text;
  v_actor_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.expense_shares es
    WHERE es.id = p_share_id
      AND es.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only report your own share';
  END IF;

  SELECT ex.event_id, es.expense_id, ex.paid_by_user_id, es.amount_due, ex.title, p.display_name
  INTO v_event_id, v_expense_id, v_collector_id, v_amount, v_expense_title, v_actor_name
  FROM public.expense_shares es
  JOIN public.expenses ex ON ex.id = es.expense_id
  JOIN public.profiles p ON p.id = es.user_id
  WHERE es.id = p_share_id;

  UPDATE public.expense_shares
  SET status = 'reported_paid',
      reported_paid_at = now(),
      note = p_note,
      proof_path = p_proof_path
  WHERE id = p_share_id;

  INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  VALUES (v_event_id, auth.uid(), 'payment_reported', 'expense_share', p_share_id, jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title));

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (v_collector_id, 'comprobante_subido', jsonb_build_object('event_id', v_event_id, 'share_id', p_share_id, 'message', v_actor_name || ' reportó un pago para ' || v_expense_title));
END;
$$;

-- 3. RESTORE: set_share_review authorization check
-- Lost in 202603140006 — any user could confirm/reject any share
CREATE OR REPLACE FUNCTION public.set_share_review(
  p_share_id uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_expense_id uuid;
  v_payer_id uuid;
  v_amount numeric;
  v_expense_title text;
  v_actor_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported review action';
  END IF;

  IF NOT public.event_is_reviewable_by_me(p_share_id) THEN
    RAISE EXCEPTION 'You cannot review this share';
  END IF;

  SELECT ex.event_id, es.expense_id, es.user_id, es.amount_due, ex.title, p.display_name
  INTO v_event_id, v_expense_id, v_payer_id, v_amount, v_expense_title, v_actor_name
  FROM public.expense_shares es
  JOIN public.expenses ex ON ex.id = es.expense_id
  JOIN public.profiles p ON p.id = ex.paid_by_user_id
  WHERE es.id = p_share_id;

  IF p_action = 'confirmed' THEN
    UPDATE public.expense_shares
    SET status = 'confirmed',
        confirmed_at = now(),
        confirmed_by_user_id = auth.uid()
    WHERE id = p_share_id;
    INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
    VALUES (v_event_id, auth.uid(), 'payment_confirmed', 'expense_share', p_share_id, jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title));
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (v_payer_id, 'pago_confirmado', jsonb_build_object('event_id', v_event_id, 'share_id', p_share_id, 'message', v_actor_name || ' confirmó tu pago para ' || v_expense_title));
  ELSIF p_action = 'rejected' THEN
    UPDATE public.expense_shares SET status = 'rejected' WHERE id = p_share_id;
    INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
    VALUES (v_event_id, auth.uid(), 'payment_rejected', 'expense_share', p_share_id, jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title));
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (v_payer_id, 'pago_rechazado', jsonb_build_object('event_id', v_event_id, 'share_id', p_share_id, 'message', v_actor_name || ' rechazó tu comprobante para ' || v_expense_title));
  END IF;
END;
$$;

-- 4. RESTORE: create_manual_birthday_event guards
-- Lost in 202603140006: birthday-user self-creation guard, min 3 members, wishlist copy
CREATE OR REPLACE FUNCTION public.create_manual_birthday_event(
  p_group_id uuid,
  p_birthday_user_id uuid,
  p_birthday_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_birthday_date date;
  v_year int;
  v_actor_name text;
  v_member_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() = p_birthday_user_id THEN
    RAISE EXCEPTION 'The birthday user cannot create their own secret event';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.group_members
  WHERE group_id = p_group_id;

  IF v_member_count < 3 THEN
    RAISE EXCEPTION 'A secret event requires at least 3 group members';
  END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  IF p_birthday_date IS NOT NULL THEN
    v_birthday_date := p_birthday_date;
  ELSE
    SELECT make_date(extract(year from now())::int, birthday_month, birthday_day) INTO v_birthday_date
    FROM public.profiles
    WHERE id = p_birthday_user_id;
  END IF;

  v_year := extract(year from v_birthday_date);

  IF EXISTS (
    SELECT 1 FROM public.birthday_events
    WHERE group_id = p_group_id
      AND birthday_user_id = p_birthday_user_id
      AND event_year = v_year
  ) THEN
    RAISE EXCEPTION 'An event already exists for this birthday in this group and year';
  END IF;

  INSERT INTO public.birthday_events (
    group_id,
    birthday_user_id,
    organizer_id,
    birthday_date,
    event_year,
    auto_created,
    status,
    activated_at
  )
  VALUES (
    p_group_id,
    p_birthday_user_id,
    auth.uid(),
    v_birthday_date,
    v_year,
    false,
    'active',
    now()
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.event_participants (event_id, user_id, role)
  VALUES (v_event_id, auth.uid(), 'organizer');

  INSERT INTO public.event_participants (event_id, user_id, role)
  SELECT v_event_id, gm.user_id, 'participant'
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id
    AND gm.user_id <> p_birthday_user_id
    AND gm.user_id <> auth.uid();

  -- Copy birthday user's wishlist items as gift options
  INSERT INTO public.gift_options (event_id, source_type, wishlist_item_id, title, url, notes, price_estimate, proposed_by, status)
  SELECT v_event_id,
         'wishlist',
         wi.id,
         wi.title,
         wi.url,
         wi.notes,
         wi.price_estimate,
         auth.uid(),
         'proposed'
  FROM public.wishlist_items wi
  WHERE wi.user_id = p_birthday_user_id;

  INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  VALUES (
    v_event_id,
    auth.uid(),
    'event_created',
    'birthday_event',
    v_event_id,
    jsonb_build_object('auto_created', false)
  );

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT gm.user_id,
         'evento_creado',
         jsonb_build_object(
           'event_id', v_event_id,
           'message', v_actor_name || ' inició un nuevo plan secreto'
         )
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id
    AND gm.user_id <> p_birthday_user_id
    AND gm.user_id <> auth.uid();

  RETURN v_event_id;
END;
$$;

-- 5. ADD MISSING GRANTs for functions called by frontend

-- get_share_payment_details (was in 0001 but dropped in 0001 re-creation, need to re-grant)
GRANT EXECUTE ON FUNCTION public.get_share_payment_details(uuid) TO authenticated;

-- create_gathering_event (defined in 0001/0002, never granted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_gathering_event') THEN
    GRANT EXECUTE ON FUNCTION public.create_gathering_event(uuid, text, date, text[]) TO authenticated;
  END IF;
END $$;

-- create_expense_with_shares_v2 (defined in 0001/0004, never granted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_expense_with_shares_v2') THEN
    GRANT EXECUTE ON FUNCTION public.create_expense_with_shares_v2(uuid, text, text, text, numeric, uuid, uuid, text, uuid[], text, numeric[]) TO authenticated;
  END IF;
END $$;

-- vote_gift, unvote_gift, get_gift_votes (defined in 0002_gift_functions, never granted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'vote_gift') THEN
    GRANT EXECUTE ON FUNCTION public.vote_gift(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'unvote_gift') THEN
    GRANT EXECUTE ON FUNCTION public.unvote_gift(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_gift_votes') THEN
    GRANT EXECUTE ON FUNCTION public.get_gift_votes(uuid) TO authenticated;
  END IF;
END $$;

-- complete_event (defined in 0002_gift_functions, never granted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_event') THEN
    GRANT EXECUTE ON FUNCTION public.complete_event(uuid) TO authenticated;
  END IF;
END $$;

-- update_rsvp (defined in 0002_gift_functions, never granted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_rsvp') THEN
    GRANT EXECUTE ON FUNCTION public.update_rsvp(uuid, text) TO authenticated;
  END IF;
END $$;

-- create_manual_birthday_event (re-grant with new signature if changed)
GRANT EXECUTE ON FUNCTION public.create_manual_birthday_event(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_share_payment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_share_review(uuid, text) TO authenticated;
