-- Update create_gift_exchange to auto-add ALL group members as participants.
-- The RPC runs as SECURITY DEFINER so it bypasses RLS — no extra policies needed.
CREATE OR REPLACE FUNCTION public.create_gift_exchange(
  p_group_id uuid,
  p_name text,
  p_budget numeric default null,
  p_exchange_date date default null,
  p_description text default null
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'You are not a member of this group';
  END IF;

  INSERT INTO public.gift_exchanges (group_id, name, description, budget, exchange_date, created_by)
  VALUES (p_group_id, COALESCE(NULLIF(p_name, ''), 'Intercambio'), p_description, p_budget, p_exchange_date, auth.uid())
  RETURNING id INTO v_id;

  -- Add ALL group members automatically (SECURITY DEFINER bypasses RLS).
  FOR v_member_id IN
    SELECT user_id FROM public.group_members WHERE group_id = p_group_id
  LOOP
    INSERT INTO public.exchange_participants (exchange_id, user_id)
    VALUES (v_id, v_member_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_gift_exchange(uuid, text, numeric, date, text) TO authenticated;

-- Also drop the admin policy if it was already applied (this RPC approach supersedes it).
DROP POLICY IF EXISTS admins_can_add_exchange_participants ON public.exchange_participants;
