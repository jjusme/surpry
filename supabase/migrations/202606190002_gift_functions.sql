-- Migration 202606190002_gift_functions.sql
-- Funciones de votación y completar evento

-- Votar por un regalo
CREATE OR REPLACE FUNCTION public.vote_gift(p_gift_option_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.gift_votes (gift_option_id, user_id)
  VALUES (p_gift_option_id, auth.uid())
  ON CONFLICT (gift_option_id, user_id) DO NOTHING;
END;
$$;

-- Quitar voto
CREATE OR REPLACE FUNCTION public.unvote_gift(p_gift_option_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.gift_votes
  WHERE gift_option_id = p_gift_option_id AND user_id = auth.uid();
END;
$$;

-- Obtener votos de un regalo
CREATE OR REPLACE FUNCTION public.get_gift_votes(p_gift_option_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gv.user_id, p.display_name, p.avatar_url
  FROM public.gift_votes gv
  JOIN public.profiles p ON p.id = gv.user_id
  WHERE gv.gift_option_id = p_gift_option_id;
$$;

-- Completar evento
CREATE OR REPLACE FUNCTION public.complete_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer uuid;
  v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT organizer_id, group_id INTO v_organizer, v_group_id
  FROM public.birthday_events WHERE id = p_event_id;

  IF v_organizer IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_organizer <> auth.uid() AND NOT public.is_group_admin(v_group_id) THEN
    RAISE EXCEPTION 'Only the organizer or group admin can complete this event';
  END IF;

  UPDATE public.birthday_events
  SET status = 'completed', closed_at = now()
  WHERE id = p_event_id AND status <> 'completed';

  -- Guardar en historial de regalos los que estén como "bought"
  INSERT INTO public.gift_history (event_id, recipient_id, giver_id, gift_title, gift_url, year)
  SELECT p_event_id, be.birthday_user_id, go.bought_by_user_id, go.title, go.url, COALESCE(be.event_year, EXTRACT(YEAR FROM now())::int)
  FROM public.gift_options go
  JOIN public.birthday_events be ON be.id = go.event_id
  WHERE go.event_id = p_event_id AND go.status = 'bought' AND go.bought_by_user_id IS NOT NULL;
END;
$$;

-- RSVP
CREATE OR REPLACE FUNCTION public.update_rsvp(p_event_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_status NOT IN ('pending','confirmed','declined') THEN
    RAISE EXCEPTION 'Invalid RSVP status';
  END IF;
  UPDATE public.event_participants
  SET rsvp_status = p_status
  WHERE event_id = p_event_id AND user_id = auth.uid();
END;
$$;
