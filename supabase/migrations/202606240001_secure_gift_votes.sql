-- =====================================================
-- DEFENSE IN DEPTH: gift vote functions
-- vote_gift / unvote_gift / get_gift_votes are SECURITY DEFINER and
-- therefore bypass RLS. Restore an explicit event-membership check so a
-- user can only vote/read votes on gift options of events they participate in.
-- =====================================================

CREATE OR REPLACE FUNCTION public.vote_gift(p_gift_option_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT event_id INTO v_event_id FROM public.gift_options WHERE id = p_gift_option_id;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'Gift option not found'; END IF;
  IF NOT public.can_access_event_data(v_event_id) THEN
    RAISE EXCEPTION 'You cannot vote on this gift';
  END IF;

  INSERT INTO public.gift_votes (gift_option_id, user_id)
  VALUES (p_gift_option_id, auth.uid())
  ON CONFLICT (gift_option_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unvote_gift(p_gift_option_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT event_id INTO v_event_id FROM public.gift_options WHERE id = p_gift_option_id;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'Gift option not found'; END IF;
  IF NOT public.can_access_event_data(v_event_id) THEN
    RAISE EXCEPTION 'You cannot vote on this gift';
  END IF;

  DELETE FROM public.gift_votes
  WHERE gift_option_id = p_gift_option_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_gift_votes(p_gift_option_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT event_id INTO v_event_id FROM public.gift_options WHERE id = p_gift_option_id;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'Gift option not found'; END IF;
  IF NOT public.can_access_event_data(v_event_id) THEN
    RAISE EXCEPTION 'You cannot view votes for this gift';
  END IF;

  RETURN QUERY
  SELECT gv.user_id, p.display_name, p.avatar_url
  FROM public.gift_votes gv
  JOIN public.profiles p ON p.id = gv.user_id
  WHERE gv.gift_option_id = p_gift_option_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_gift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unvote_gift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gift_votes(uuid) TO authenticated;
