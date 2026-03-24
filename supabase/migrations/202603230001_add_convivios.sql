-- Migration 202603230001_add_convivios.sql

-- 1. Generalize birthday_events
ALTER TABLE public.birthday_events 
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'birthday' CHECK (event_type IN ('birthday', 'gathering')),
  ADD COLUMN IF NOT EXISTS title text,
  ALTER COLUMN birthday_user_id DROP NOT NULL,
  ALTER COLUMN birthday_date DROP NOT NULL,
  ALTER COLUMN event_year DROP NOT NULL;

-- 2. Generalize event_participants to support virtual users
ALTER TABLE public.event_participants
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS is_virtual boolean NOT NULL DEFAULT false;

-- Add check constraint to ensure either user_id or display_name is present
ALTER TABLE public.event_participants 
  ADD CONSTRAINT event_participants_identity_check 
  CHECK ((user_id IS NOT NULL AND NOT is_virtual) OR (display_name IS NOT NULL AND is_virtual));

-- 3. Update expenses for split types
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS split_type text NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'manual'));

-- 4. Update expense_shares to link to participants instead of only profiles
ALTER TABLE public.expense_shares
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.event_participants(id) ON DELETE CASCADE,
  ALTER COLUMN user_id DROP NOT NULL;

-- 5. Backfill participant_id in expense_shares for existing data
DO $$
BEGIN
  UPDATE public.expense_shares es
  SET participant_id = ep.id
  FROM public.event_participants ep
  JOIN public.expenses ex ON ex.event_id = ep.event_id
  WHERE es.expense_id = ex.id 
    AND es.user_id = ep.user_id
    AND es.participant_id IS NULL;
END $$;

-- 6. Update RLS policies
CREATE OR REPLACE FUNCTION public.can_view_event_shell(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.birthday_events be
    JOIN public.group_members gm
      ON gm.group_id = be.group_id
    WHERE be.id = p_event_id
      AND gm.user_id = auth.uid()
      AND (be.event_type = 'gathering' OR be.birthday_user_id <> auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_event_data(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = auth.uid()
  );
$$;

-- 7. Add RPC for creating gatherings
CREATE OR REPLACE FUNCTION public.create_gathering_event(
  p_group_id uuid, 
  p_title text, 
  p_date date,
  p_virtual_participants text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_virtual_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_group_member(p_group_id) THEN RAISE EXCEPTION 'You are not a member of this group'; END IF;

  INSERT INTO public.birthday_events (
    group_id, organizer_id, title, birthday_date, event_type, status
  )
  VALUES (
    p_group_id, auth.uid(), p_title, p_date, 'gathering', 'draft'
  )
  RETURNING id INTO v_event_id;

  -- Add organizer
  INSERT INTO public.event_participants (event_id, user_id, role, is_virtual)
  VALUES (v_event_id, auth.uid(), 'organizer', false);

  -- Add group members
  INSERT INTO public.event_participants (event_id, user_id, role, is_virtual)
  SELECT v_event_id, gm.user_id, 'participant', false
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id AND gm.user_id <> auth.uid();

  -- Add virtuals
  IF p_virtual_participants IS NOT NULL THEN
    FOREACH v_virtual_name IN ARRAY p_virtual_participants LOOP
      INSERT INTO public.event_participants (event_id, display_name, role, is_virtual)
      VALUES (v_event_id, v_virtual_name, 'participant', true);
    END LOOP;
  END IF;

  INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  VALUES (v_event_id, auth.uid(), 'event_created', 'gathering_event', v_event_id, jsonb_build_object('title', p_title));

  RETURN v_event_id;
END;
$$;

-- 8. Updated expense creation
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_paid_by_user_id <> auth.uid() THEN RAISE EXCEPTION 'You can only create expenses paid by yourself'; END IF;

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
  END LOOP;

  SELECT status INTO v_event_status FROM public.birthday_events WHERE id = p_event_id;
  IF v_event_status = 'draft' THEN
    UPDATE public.birthday_events SET status = 'active', activated_at = now() WHERE id = p_event_id;
  END IF;

  INSERT INTO public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  VALUES (p_event_id, auth.uid(), 'expense_created', 'expense', v_expense_id, jsonb_build_object('title', p_title, 'amount', p_amount));

  RETURN v_expense_id;
END;
$$;
