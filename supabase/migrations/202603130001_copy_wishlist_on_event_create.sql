-- Update create_manual_birthday_event and create_missing_birthday_events
-- to automatically copy the user's wishlist into the event's gift_options.

create or replace function public.create_manual_birthday_event(p_group_id uuid, p_birthday_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day int;
  v_month int;
  v_year int;
  v_birthday_date date;
  v_event_id uuid;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() = p_birthday_user_id then
    raise exception 'The birthday user cannot create their own secret event';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group';
  end if;

  select count(*) into v_member_count
  from public.group_members
  where group_id = p_group_id;

  if v_member_count < 3 then
    raise exception 'A secret event requires at least 3 group members';
  end if;

  select birthday_day, birthday_month
    into v_day, v_month
  from public.profiles
  where id = p_birthday_user_id;

  if v_day is null or v_month is null then
    raise exception 'The birthday user must have a birthday configured';
  end if;

  v_year := extract(year from current_date)::int;
  v_birthday_date := make_date(v_year, v_month, v_day);
  if v_birthday_date < current_date then
    v_year := v_year + 1;
    v_birthday_date := make_date(v_year, v_month, v_day);
  end if;

  if exists (
    select 1
    from public.birthday_events be
    where be.group_id = p_group_id
      and be.birthday_user_id = p_birthday_user_id
      and be.event_year = v_year
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
    status
  )
  values (
    p_group_id,
    p_birthday_user_id,
    auth.uid(),
    v_birthday_date,
    v_year,
    false,
    'draft'
  )
  returning id into v_event_id;

  -- INSERT ALL GROUP MEMBERS AS PARTICIPANTS (except the birthday user)
  insert into public.event_participants (event_id, user_id, role)
  select v_event_id, gm.user_id, case when gm.user_id = auth.uid() then 'organizer' else 'participant' end
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> p_birthday_user_id;

  -- INSERT WISHLIST ITEMS AS GIFT OPTIONS
  insert into public.gift_options (
    event_id, source_type, wishlist_item_id, title, url, notes, price_estimate, proposed_by, status
  )
  select
    v_event_id,
    'wishlist',
    id,
    title,
    url,
    notes,
    price_estimate,
    auth.uid(),
    'proposed'
  from public.wishlist_items
  where user_id = p_birthday_user_id;

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
           'message', 'Se creo un nuevo evento secreto en tu grupo.'
         )
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> auth.uid()
    and gm.user_id <> p_birthday_user_id;

  return v_event_id;
end;
$$;


create or replace function public.create_missing_birthday_events()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_date date;
  v_created int := 0;
  rec record;
  v_organizer uuid;
  v_event_id uuid;
begin
  for rec in
    select g.id as group_id,
           g.auto_create_days_before,
           p.id as birthday_user_id,
           make_date(extract(year from current_date + g.auto_create_days_before)::int, p.birthday_month, p.birthday_day) as birthday_date,
           extract(year from current_date + g.auto_create_days_before)::int as event_year
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    join public.profiles p on p.id = gm.user_id
    where p.birthday_day is not null
      and p.birthday_month is not null
      and (select count(*) from public.group_members gmc where gmc.group_id = g.id) >= 3
  loop
    v_target_date := current_date + (select auto_create_days_before from public.groups where id = rec.group_id);

    if extract(day from rec.birthday_date) = extract(day from v_target_date)
       and extract(month from rec.birthday_date) = extract(month from v_target_date)
       and not exists (
         select 1
         from public.birthday_events be
         where be.group_id = rec.group_id
           and be.birthday_user_id = rec.birthday_user_id
           and be.event_year = rec.event_year
       ) then
      select gm.user_id
        into v_organizer
      from public.group_members gm
      where gm.group_id = rec.group_id
        and gm.user_id <> rec.birthday_user_id
      order by case when gm.role = 'admin' then 0 else 1 end, gm.joined_at
      limit 1;

      if v_organizer is null then
        continue;
      end if;

      insert into public.birthday_events (
        group_id,
        birthday_user_id,
        organizer_id,
        birthday_date,
        event_year,
        auto_created,
        status
      )
      values (
        rec.group_id,
        rec.birthday_user_id,
        v_organizer,
        rec.birthday_date,
        rec.event_year,
        true,
        'draft'
      )
      returning id into v_event_id;

      -- INSERT ALL GROUP MEMBERS AS PARTICIPANTS (except the birthday user)
      insert into public.event_participants (event_id, user_id, role)
      select v_event_id, gm.user_id, case when gm.user_id = v_organizer then 'organizer' else 'participant' end
      from public.group_members gm
      where gm.group_id = rec.group_id
        and gm.user_id <> rec.birthday_user_id;

      -- INSERT WISHLIST ITEMS AS GIFT OPTIONS
      insert into public.gift_options (
        event_id, source_type, wishlist_item_id, title, url, notes, price_estimate, proposed_by, status
      )
      select
        v_event_id,
        'wishlist',
        id,
        title,
        url,
        notes,
        price_estimate,
        v_organizer,
        'proposed'
      from public.wishlist_items
      where user_id = rec.birthday_user_id;

      insert into public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
      values (
        v_event_id,
        v_organizer,
        'event_created',
        'birthday_event',
        v_event_id,
        jsonb_build_object('auto_created', true)
      );

      insert into public.notifications (user_id, type, payload)
      select gm.user_id,
             'evento_creado',
             jsonb_build_object(
               'event_id', v_event_id,
               'message', concat('¡Se ha creado automáticamente el evento para ', (select display_name from public.profiles where id = rec.birthday_user_id), '!')
             )
      from public.group_members gm
      where gm.group_id = rec.group_id
        and gm.user_id <> rec.birthday_user_id;

      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;
