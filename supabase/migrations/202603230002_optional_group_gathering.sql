-- Migration 202603230002_optional_group_gathering.sql

-- Make group_id nullable in birthday_events
ALTER TABLE public.birthday_events ALTER COLUMN group_id DROP NOT NULL;

-- Update the view shell policy to handle null group_id
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
    LEFT JOIN public.group_members gm
      ON gm.group_id = be.group_id AND gm.user_id = auth.uid()
    LEFT JOIN public.event_participants ep
      ON ep.event_id = be.id AND ep.user_id = auth.uid()
    WHERE be.id = p_event_id
      AND (
        -- If it has a group, must be group member (and birthday logic if birthday type)
        (be.group_id IS NOT NULL AND gm.user_id IS NOT NULL AND (be.event_type = 'gathering' OR be.birthday_user_id <> auth.uid()))
        OR 
        -- If no group, must be an explicit participant
        (be.group_id IS NULL AND ep.user_id IS NOT NULL)
      )
  );
$$;

-- Update the existing create_gathering_event function to allow NULL group_id
CREATE OR REPLACE FUNCTION public.create_gathering_event(
  p_group_id uuid, -- Now can be NULL
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
  
  -- If group_id is provided, check membership
  IF p_group_id IS NOT NULL THEN
    IF NOT public.is_group_member(p_group_id) THEN 
      RAISE EXCEPTION 'You are not a member of this group'; 
    END IF;
  END IF;

  INSERT INTO public.birthday_events (
    group_id, organizer_id, title, birthday_date, event_type, status, event_year
  )
  VALUES (
    p_group_id, auth.uid(), p_title, p_date, 'gathering', 'draft', extract(year from p_date)::int
  )
  RETURNING id INTO v_event_id;

  -- Add organizer as participant
  INSERT INTO public.event_participants (event_id, user_id, role, is_virtual)
  VALUES (v_event_id, auth.uid(), 'organizer', false);

  -- Add group members if group_id is provided
  IF p_group_id IS NOT NULL THEN
    INSERT INTO public.event_participants (event_id, user_id, role, is_virtual)
    SELECT v_event_id, gm.user_id, 'participant', false
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id AND gm.user_id <> auth.uid();
  END IF;

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
