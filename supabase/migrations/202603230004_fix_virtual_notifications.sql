-- Migration 202603230004_fix_virtual_notifications.sql

-- 1. Fix set_share_review to handle null user_id (virtual participants)
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
  -- Get share and expense details
  -- Use LEFT JOIN on profiles for the payer since they might not be a user (for virtuals, es.user_id is null)
  SELECT 
    ex.event_id, 
    es.expense_id, 
    es.user_id, 
    es.amount_due, 
    ex.title, 
    p_actor.display_name
  INTO 
    v_event_id, 
    v_expense_id, 
    v_payer_id, 
    v_amount, 
    v_expense_title, 
    v_actor_name
  FROM public.expense_shares es
  JOIN public.expenses ex ON ex.id = es.expense_id
  JOIN public.profiles p_actor ON p_actor.id = auth.uid()
  WHERE es.id = p_share_id;

  IF p_action = 'confirmed' THEN
    UPDATE public.expense_shares
    SET status = 'confirmed',
        confirmed_at = now(),
        confirmed_by_user_id = auth.uid()
    WHERE id = p_share_id;

    INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
    VALUES (v_event_id, auth.uid(), 'payment_confirmed', 'expense_share', p_share_id, jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title));

    -- Only send notification if there is a real user linked to this share
    IF v_payer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (v_payer_id, 'pago_confirmado', jsonb_build_object('event_id', v_event_id, 'share_id', p_share_id, 'message', v_actor_name || ' confirmó tu pago para ' || v_expense_title));
    END IF;

  ELSIF p_action = 'rejected' THEN
    UPDATE public.expense_shares SET status = 'rejected' WHERE id = p_share_id;

    INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
    VALUES (v_event_id, auth.uid(), 'payment_rejected', 'expense_share', p_share_id, jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title));

    -- Only send notification if there is a real user linked to this share
    IF v_payer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (v_payer_id, 'pago_rechazado', jsonb_build_object('event_id', v_event_id, 'share_id', p_share_id, 'message', v_actor_name || ' rechazó tu comprobante para ' || v_expense_title));
    END IF;
  END IF;
END;
$$;

-- 2. Add notifications to create_expense_with_shares_v2
CREATE OR REPLACE FUNCTION public.create_expense_with_shares_v2(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_amount numeric,
  p_paid_by_user_id uuid,
  p_reimbursement_destination_id uuid,
  p_receipt_path text,
  p_participant_ids uuid[], -- event_participants(id)
  p_split_type text DEFAULT 'equal',
  p_custom_amounts numeric[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_count int;
  v_base numeric(12,2);
  v_running numeric(12,2) := 0;
  v_participant_id uuid;
  v_index int := 0;
  v_event_status text;
  v_user_id uuid;
  v_amount_due numeric(12,2);
  v_actor_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_paid_by_user_id <> auth.uid() THEN RAISE EXCEPTION 'You can only create expenses paid by yourself'; END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  v_count := coalesce(array_length(p_participant_ids, 1), 0);
  IF v_count = 0 THEN RAISE EXCEPTION 'At least one participant is required'; END IF;

  INSERT INTO public.expenses (
    event_id, title, description, category, amount, 
    paid_by_user_id, reimbursement_destination_id, receipt_path, 
    created_by_user_id, split_type
  )
  VALUES (
    p_event_id, p_title, p_description, p_category, p_amount, 
    p_paid_by_user_id, p_reimbursement_destination_id, p_receipt_path, 
    auth.uid(), p_split_type
  )
  RETURNING id INTO v_expense_id;

  v_base := round(p_amount / v_count, 2);

  FOR v_index IN 1..v_count LOOP
    v_participant_id := p_participant_ids[v_index];
    SELECT user_id INTO v_user_id FROM public.event_participants WHERE id = v_participant_id;

    IF p_split_type = 'equal' THEN
      v_amount_due := CASE WHEN v_index = v_count THEN p_amount - v_running ELSE v_base END;
      v_running := v_running + v_amount_due;
    ELSE
      v_amount_due := p_custom_amounts[v_index];
    END IF;

    INSERT INTO public.expense_shares (expense_id, user_id, participant_id, amount_due, status)
    VALUES (v_expense_id, v_user_id, v_participant_id, v_amount_due, 'pending');

    -- Auto-confirm the payer's share
    IF v_user_id = p_paid_by_user_id THEN
      UPDATE public.expense_shares 
      SET status = 'confirmed', confirmed_at = now(), confirmed_by_user_id = auth.uid()
      WHERE expense_id = v_expense_id AND user_id = v_user_id;
    END IF;
  END LOOP;

  -- Notifications for real users only
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT ep.user_id, 'gasto_registrado', 
         jsonb_build_object(
           'event_id', p_event_id, 
           'expense_id', v_expense_id, 
           'message', v_actor_name || ' registró un gasto: ' || p_title
         )
  FROM public.event_participants ep
  WHERE ep.id = ANY(p_participant_ids) 
    AND ep.user_id IS NOT NULL 
    AND ep.user_id <> auth.uid();

  SELECT status INTO v_event_status FROM public.birthday_events WHERE id = p_event_id;
  IF v_event_status = 'draft' THEN
    UPDATE public.birthday_events SET status = 'active', activated_at = now() WHERE id = p_event_id;
  END IF;

  INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  VALUES (p_event_id, auth.uid(), 'expense_created', 'expense', v_expense_id, jsonb_build_object('title', p_title, 'amount', p_amount));

  RETURN v_expense_id;
END;
$$;
