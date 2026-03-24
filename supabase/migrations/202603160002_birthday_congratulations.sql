-- Function to notify users on their birthday and remind participants of active events
CREATE OR REPLACE FUNCTION public.notify_todays_birthdays()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_actor_name text;
BEGIN
  -- 1. Notify the birthday person
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT id, 
         'cumpleanos_hoy', 
         jsonb_build_object(
           'message', '¡Feliz cumpleaños, ' || split_part(display_name, ' ', 1) || '! 🎉 Tus cómplices han estado preparando algo especial para ti.'
         )
  FROM public.profiles
  WHERE birthday_day = extract(day from current_date)
    AND birthday_month = extract(month from current_date);

  -- 2. Remind participants of active events today
  FOR rec IN 
    SELECT be.id as event_id, ep.user_id, p.display_name as birthday_person
    FROM public.birthday_events be
    JOIN public.event_participants ep ON ep.event_id = be.id
    JOIN public.profiles p ON p.id = be.birthday_user_id
    WHERE be.status = 'active'
      AND extract(day from be.birthday_date) = extract(day from current_date)
      AND extract(month from be.birthday_date) = extract(month from current_date)
      AND ep.user_id <> be.birthday_user_id
  LOOP
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      rec.user_id,
      'recordatorio_cumpleanos',
      jsonb_build_object(
        'event_id', rec.event_id,
        'message', '¡Hoy es el cumple de ' || rec.birthday_person || '! 🎂 No olvides revisar los detalles finales en el plan.'
      )
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_todays_birthdays() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_todays_birthdays() TO service_role;
