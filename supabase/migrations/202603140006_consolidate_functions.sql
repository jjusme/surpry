-- Consolidation of SQL functions to resolve overloading and naming mismatches
-- This migration drops old versions and re-defines them exactly as the frontend expects.

-- 1. CLEAN UP: Drop all possible previous overloads
DROP FUNCTION IF EXISTS public.create_manual_birthday_event(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_manual_birthday_event(uuid, uuid, date);
DROP FUNCTION IF EXISTS public.create_expense_with_shares(uuid, text, text, numeric, uuid[], uuid, text);
DROP FUNCTION IF EXISTS public.create_expense_with_shares(uuid, text, text, numeric, uuid, uuid, text, uuid[]);
DROP FUNCTION IF EXISTS public.report_share_paid(uuid, jsonb);
DROP FUNCTION IF EXISTS public.report_share_payment(uuid, text, text);
DROP FUNCTION IF EXISTS public.review_share(uuid, text);
DROP FUNCTION IF EXISTS public.set_share_review(uuid, text);

-- 2. REDEFINE: create_manual_birthday_event
-- Matches: createEvent(groupId, birthdayUserId) in events/service.js
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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

  -- Enroll all other group members as participants
  INSERT INTO public.event_participants (event_id, user_id, role)
  SELECT v_event_id, gm.user_id, 'participant'
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id
    AND gm.user_id <> p_birthday_user_id
    AND gm.user_id <> auth.uid();

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

-- 3. REDEFINE: create_expense_with_shares
-- Matches: createExpenseWithShares(values) in events/service.js
CREATE OR REPLACE FUNCTION public.create_expense_with_shares(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_amount numeric,
  p_paid_by_user_id uuid,
  p_reimbursement_destination_id uuid DEFAULT NULL,
  p_receipt_path text DEFAULT NULL,
  p_participant_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_participant uuid;
  v_count int;
  v_base numeric;
  v_running numeric := 0;
  v_index int := 0;
  v_event_status text;
  v_actor_name text;
BEGIN
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.expenses (
    event_id,
    paid_by_user_id,
    title,
    description,
    category,
    amount,
    reimbursement_destination_id,
    receipt_path,
    created_by_user_id
  )
  VALUES (
    p_event_id,
    p_paid_by_user_id,
    p_title,
    p_description,
    p_category,
    p_amount,
    p_reimbursement_destination_id,
    p_receipt_path,
    auth.uid()
  )
  RETURNING id INTO v_expense_id;

  v_count := array_length(p_participant_ids, 1);
  IF v_count IS NOT NULL AND v_count > 0 THEN
    v_base := round(p_amount / v_count, 2);

    FOREACH v_participant IN ARRAY p_participant_ids LOOP
      v_index := v_index + 1;
      INSERT INTO public.expense_shares (expense_id, user_id, amount_due, status, confirmed_at, confirmed_by_user_id)
      VALUES (
        v_expense_id,
        v_participant,
        CASE WHEN v_index = v_count THEN round(p_amount - v_running, 2) ELSE v_base END,
        CASE WHEN v_participant = p_paid_by_user_id THEN 'confirmed' ELSE 'pending' END,
        CASE WHEN v_participant = p_paid_by_user_id THEN now() ELSE NULL END,
        CASE WHEN v_participant = p_paid_by_user_id THEN p_paid_by_user_id ELSE NULL END
      );
      IF v_index < v_count THEN v_running := v_running + v_base; END IF;
    END LOOP;
  END IF;

  SELECT status INTO v_event_status FROM public.birthday_events WHERE id = p_event_id;
  IF v_event_status = 'draft' THEN
    UPDATE public.birthday_events SET status = 'active', activated_at = now() WHERE id = p_event_id;
  END IF;

  INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  VALUES (p_event_id, auth.uid(), 'expense_created', 'expense', v_expense_id, jsonb_build_object('title', p_title, 'amount', p_amount));

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT participant_id, 'gasto_registrado', jsonb_build_object('event_id', p_event_id, 'expense_id', v_expense_id, 'message', v_actor_name || ' registró un gasto: ' || p_title)
  FROM unnest(p_participant_ids) AS participant_id
  WHERE participant_id <> auth.uid();

  RETURN v_expense_id;
END;
$$;

-- 4. REDEFINE: report_share_payment
-- Matches: reportSharePaid(shareId, values) in events/service.js (calling report_share_payment)
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

-- 5. REDEFINE: set_share_review
-- Matches: reviewShare(shareId, action) in events/service.js (calling set_share_review)
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

-- GRANTS
GRANT EXECUTE ON FUNCTION public.create_manual_birthday_event(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_with_shares(uuid, text, text, text, numeric, uuid, uuid, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_share_payment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_share_review(uuid, text) TO authenticated;
