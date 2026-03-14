-- Refine notification messages with actor names

-- 1. Redefine create_expense_with_shares
create or replace function public.create_expense_with_shares(
  p_event_id uuid,
  p_title text,
  p_category text,
  p_amount numeric,
  p_participant_ids uuid[],
  p_reimbursement_destination_id uuid default null,
  p_receipt_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_participant uuid;
  v_count int;
  v_base numeric;
  v_running numeric := 0;
  v_index int := 0;
  v_event_status text;
  v_actor_name text;
begin
  -- Get actor name
  select display_name into v_actor_name from public.profiles where id = auth.uid();

  insert into public.expenses (
    event_id,
    paid_by_user_id,
    title,
    category,
    amount,
    reimbursement_destination_id,
    receipt_url
  )
  values (
    p_event_id,
    auth.uid(),
    p_title,
    p_category,
    p_amount,
    p_reimbursement_destination_id,
    p_receipt_url
  )
  returning id into v_expense_id;

  v_count := array_length(p_participant_ids, 1);
  if v_count is null or v_count = 0 then
    raise exception 'No participants selected';
  end if;

  v_base := round(p_amount / v_count, 2);

  foreach v_participant in array p_participant_ids loop
    v_index := v_index + 1;
    insert into public.expense_shares (
      expense_id,
      user_id,
      amount_due,
      status
    )
    values (
      v_expense_id,
      v_participant,
      case
        when v_index = v_count then round(p_amount - v_running, 2)
        else v_base
      end,
      'pending'
    );

    if v_index < v_count then
      v_running := v_running + v_base;
    end if;
  end loop;

  select status into v_event_status
  from public.birthday_events
  where id = p_event_id;

  if v_event_status = 'draft' then
    update public.birthday_events
    set status = 'active',
        activated_at = now()
    where id = p_event_id;
  end if;

  insert into public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  values (
    p_event_id,
    auth.uid(),
    'expense_created',
    'expense',
    v_expense_id,
    jsonb_build_object('title', p_title, 'amount', p_amount)
  );

  insert into public.notifications (user_id, type, payload)
  select participant_id,
         'gasto_registrado',
         jsonb_build_object(
           'event_id', p_event_id,
           'expense_id', v_expense_id,
           'message', v_actor_name || ' registró un gasto: ' || p_title
         )
  from unnest(p_participant_ids) as participant_id
  where participant_id <> auth.uid();

  return v_expense_id;
end;
$$;

-- 2. Redefine report_share_paid
create or replace function public.report_share_paid(
  p_share_id uuid,
  p_metadata jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_expense_id uuid;
  v_collector_id uuid;
  v_amount numeric;
  v_expense_title text;
  v_actor_name text;
begin
  select ex.event_id, es.expense_id, ex.paid_by_user_id, es.amount_due, ex.title, p.display_name
  into v_event_id, v_expense_id, v_collector_id, v_amount, v_expense_title, v_actor_name
  from public.expense_shares es
  join public.expenses ex on ex.id = es.expense_id
  join public.profiles p on p.id = es.user_id
  where es.id = p_share_id;

  if v_collector_id is null then
    raise exception 'Share not found';
  end if;

  update public.expense_shares
  set status = 'reported_paid',
      reported_at = now(),
      payment_metadata = p_metadata
  where id = p_share_id;

  insert into public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
  values (
    v_event_id,
    auth.uid(),
    'payment_reported',
    'expense_share',
    p_share_id,
    jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title)
  );

  insert into public.notifications (user_id, type, payload)
  values (
    v_collector_id,
    'comprobante_subido',
    jsonb_build_object(
      'event_id', v_event_id,
      'share_id', p_share_id,
      'message', v_actor_name || ' reportó un pago para ' || v_expense_title
    )
  );
end;
$$;

-- 3. Redefine review_share
create or replace function public.review_share(
  p_share_id uuid,
  p_action text -- 'confirmed' or 'rejected'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_expense_id uuid;
  v_payer_id uuid;
  v_amount numeric;
  v_expense_title text;
  v_actor_name text;
begin
  select ex.event_id, es.expense_id, es.user_id, es.amount_due, ex.title, p.display_name
  into v_event_id, v_expense_id, v_payer_id, v_amount, v_expense_title, v_actor_name
  from public.expense_shares es
  join public.expenses ex on ex.id = es.expense_id
  join public.profiles p on p.id = ex.paid_by_user_id
  where es.id = p_share_id;

  if v_payer_id is null then
    raise exception 'Share not found';
  end if;

  if p_action = 'confirmed' then
    update public.expense_shares
    set status = 'confirmed',
        confirmed_at = now()
    where id = p_share_id;

    insert into public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
    values (
      v_event_id,
      auth.uid(),
      'payment_confirmed',
      'expense_share',
      p_share_id,
      jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title)
    );

    insert into public.notifications (user_id, type, payload)
    values (
      v_payer_id,
      'pago_confirmado',
      jsonb_build_object(
        'event_id', v_event_id,
        'share_id', p_share_id,
        'message', v_actor_name || ' confirmó tu pago para ' || v_expense_title
      )
    );
  elsif p_action = 'rejected' then
    update public.expense_shares
    set status = 'rejected',
        payment_metadata = payment_metadata || '{"rejected_at": "' || now()::text || '"}'::jsonb
    where id = p_share_id;

    insert into public.activity_logs (event_id, actor_user_id, action_type, target_type, target_id, metadata)
    values (
      v_event_id,
      auth.uid(),
      'payment_rejected',
      'expense_share',
      p_share_id,
      jsonb_build_object('amount', v_amount, 'expense_title', v_expense_title)
    );

    insert into public.notifications (user_id, type, payload)
    values (
      v_payer_id,
      'pago_rechazado',
      jsonb_build_object(
        'event_id', v_event_id,
        'share_id', p_share_id,
        'message', v_actor_name || ' rechazó tu comprobante para ' || v_expense_title
      )
    );
  end if;
end;
$$;

-- 4. Redefine create_manual_birthday_event to refine notification
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
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select display_name into v_actor_name from public.profiles where id = auth.uid();

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
    'active',
    now()
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
           'message', v_actor_name || ' inició un nuevo plan secreto'
         )
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> p_birthday_user_id
    and gm.user_id <> auth.uid();

  return v_event_id;
end;
$$;
