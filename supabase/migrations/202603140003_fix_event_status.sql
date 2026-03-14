-- Redefine create_manual_birthday_event to start as 'active'
drop function if exists public.create_manual_birthday_event(uuid, uuid, date);

create or replace function public.create_manual_birthday_event(
  p_group_id uuid,
  p_birthday_user_id uuid,
  p_birthday_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_birthday_date date;
  v_year int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_birthday_date is not null then
    v_birthday_date := p_birthday_date;
  else
    select (birthday_month || '-' || birthday_day)::date into v_birthday_date
    from public.profiles
    where id = p_birthday_user_id;
  end if;

  v_year := extract(year from v_birthday_date);

  if exists (
    select 1 from public.birthday_events
    where group_id = p_group_id
      and birthday_user_id = p_birthday_user_id
      and event_year = v_year
  ) then
    raise exception 'An event already exists for this birthday in this group and year';
  end if;

  insert into public.birthday_events (
    group_id,
    birthday_user_id,
    organizer_id,
    birthday_date,
    event_year,
    auto_created,
    status,
    activated_at
  )
  values (
    p_group_id,
    p_birthday_user_id,
    auth.uid(),
    v_birthday_date,
    v_year,
    false,
    'active', -- Changed from 'draft'
    now()     -- Set activated_at immediately
  )
  returning id into v_event_id;

  insert into public.event_participants (event_id, user_id, role)
  values (v_event_id, auth.uid(), 'organizer');

  insert into public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  values (
    v_event_id,
    auth.uid(),
    'event_created',
    'birthday_event',
    v_event_id,
    jsonb_build_object('auto_created', false)
  );

  insert into public.notifications (user_id, type, payload)
  select gm.user_id,
         'evento_creado',
         jsonb_build_object(
           'event_id', v_event_id,
           'message', 'Se ha creado un nuevo plan sorpresa'
         )
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> p_birthday_user_id;

  return v_event_id;
end;
$$;

grant execute on function public.create_manual_birthday_event(uuid, uuid, date) to authenticated;
