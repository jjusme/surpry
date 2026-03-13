create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  birthday_day int check (birthday_day between 1 and 31),
  birthday_month int check (birthday_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  auto_create_days_before int not null default 30 check (auto_create_days_before between 1 and 365),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  url text,
  notes text,
  price_estimate numeric(12,2),
  priority text check (priority in ('alta', 'media', 'baja')),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('clabe', 'card', 'account', 'alias', 'other')),
  label text,
  bank_name text,
  account_holder text,
  destination_value text not null,
  note text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.birthday_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  birthday_user_id uuid not null references public.profiles(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  birthday_date date not null,
  event_year int not null,
  auto_created boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz,
  unique (group_id, birthday_user_id, event_year)
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.birthday_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'participant' check (role in ('organizer', 'participant')),
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.gift_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.birthday_events(id) on delete cascade,
  source_type text not null default 'manual' check (source_type in ('wishlist', 'manual')),
  wishlist_item_id uuid references public.wishlist_items(id) on delete set null,
  title text not null,
  url text,
  notes text,
  price_estimate numeric(12,2),
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'reserved', 'bought', 'discarded')),
  bought_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_votes (
  id uuid primary key default gen_random_uuid(),
  gift_option_id uuid not null references public.gift_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gift_option_id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.birthday_events(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('gift', 'cake', 'decoration', 'snacks', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  paid_by_user_id uuid not null references public.profiles(id) on delete cascade,
  reimbursement_destination_id uuid references public.payment_destinations(id) on delete set null,
  receipt_path text,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  status text not null default 'pending' check (status in ('pending', 'reported_paid', 'confirmed', 'rejected')),
  proof_path text,
  note text,
  reported_paid_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.birthday_events(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.users_share_group(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs
      on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_other_user_id
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  );
$$;

create or replace function public.can_view_event_shell(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.birthday_events be
    join public.group_members gm
      on gm.group_id = be.group_id
    where be.id = p_event_id
      and gm.user_id = auth.uid()
      and be.birthday_user_id <> auth.uid()
  );
$$;

create or replace function public.can_access_event_data(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
      and ep.user_id = auth.uid()
  );
$$;

create or replace function public.event_is_reviewable_by_me(p_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_shares es
    join public.expenses ex on ex.id = es.expense_id
    join public.birthday_events be on be.id = ex.event_id
    where es.id = p_share_id
      and (ex.paid_by_user_id = auth.uid() or be.organizer_id = auth.uid())
  );
$$;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.payment_destinations enable row level security;
alter table public.birthday_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.gift_options enable row level security;
alter table public.gift_votes enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists profiles_select_self_or_shared on public.profiles;
create policy profiles_select_self_or_shared on public.profiles
for select
using (id = auth.uid() or public.users_share_group(id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists groups_select_members on public.groups;
create policy groups_select_members on public.groups
for select
using (public.is_group_member(id));

drop policy if exists groups_insert_creator on public.groups;
create policy groups_insert_creator on public.groups
for insert
with check (created_by = auth.uid());

drop policy if exists groups_update_admin on public.groups;
create policy groups_update_admin on public.groups
for update
using (public.is_group_admin(id))
with check (public.is_group_admin(id));

drop policy if exists group_members_select_members on public.group_members;
create policy group_members_select_members on public.group_members
for select
using (public.is_group_member(group_id));

drop policy if exists group_members_insert_self_or_admin on public.group_members;
create policy group_members_insert_self_or_admin on public.group_members
for insert
with check (
  user_id = auth.uid() and (
    exists (
      select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()
    )
    or public.is_group_admin(group_id)
  )
);

drop policy if exists group_invites_public_select on public.group_invites;
create policy group_invites_public_select on public.group_invites
for select
using (revoked_at is null);

drop policy if exists group_invites_insert_admin on public.group_invites;
create policy group_invites_insert_admin on public.group_invites
for insert
with check (created_by = auth.uid() and public.is_group_admin(group_id));

drop policy if exists wishlist_items_select_owner_or_shared on public.wishlist_items;
create policy wishlist_items_select_owner_or_shared on public.wishlist_items
for select
using (user_id = auth.uid() or public.users_share_group(user_id));

drop policy if exists wishlist_items_insert_owner on public.wishlist_items;
create policy wishlist_items_insert_owner on public.wishlist_items
for insert
with check (user_id = auth.uid());

drop policy if exists wishlist_items_update_owner on public.wishlist_items;
create policy wishlist_items_update_owner on public.wishlist_items
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists wishlist_items_delete_owner on public.wishlist_items;
create policy wishlist_items_delete_owner on public.wishlist_items
for delete
using (user_id = auth.uid());

drop policy if exists payment_destinations_owner_select on public.payment_destinations;
create policy payment_destinations_owner_select on public.payment_destinations
for select
using (user_id = auth.uid());

drop policy if exists payment_destinations_owner_insert on public.payment_destinations;
create policy payment_destinations_owner_insert on public.payment_destinations
for insert
with check (user_id = auth.uid());

drop policy if exists payment_destinations_owner_update on public.payment_destinations;
create policy payment_destinations_owner_update on public.payment_destinations
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists payment_destinations_owner_delete on public.payment_destinations;
create policy payment_destinations_owner_delete on public.payment_destinations
for delete
using (user_id = auth.uid());

drop policy if exists birthday_events_select_members_except_birthday on public.birthday_events;
create policy birthday_events_select_members_except_birthday on public.birthday_events
for select
using (public.can_view_event_shell(id));

drop policy if exists birthday_events_update_participants on public.birthday_events;
create policy birthday_events_update_participants on public.birthday_events
for update
using (public.can_access_event_data(id))
with check (public.can_access_event_data(id));

drop policy if exists event_participants_select_participants on public.event_participants;
create policy event_participants_select_participants on public.event_participants
for select
using (public.can_access_event_data(event_id));

drop policy if exists gift_options_select_participants on public.gift_options;
create policy gift_options_select_participants on public.gift_options
for select
using (public.can_access_event_data(event_id));

drop policy if exists gift_options_insert_participants on public.gift_options;
create policy gift_options_insert_participants on public.gift_options
for insert
with check (public.can_access_event_data(event_id) and proposed_by = auth.uid());

drop policy if exists gift_options_update_participants on public.gift_options;
create policy gift_options_update_participants on public.gift_options
for update
using (public.can_access_event_data(event_id))
with check (public.can_access_event_data(event_id));

drop policy if exists gift_votes_select_participants on public.gift_votes;
create policy gift_votes_select_participants on public.gift_votes
for select
using (
  exists (
    select 1 from public.gift_options go
    where go.id = gift_option_id
      and public.can_access_event_data(go.event_id)
  )
);

drop policy if exists gift_votes_insert_participants on public.gift_votes;
create policy gift_votes_insert_participants on public.gift_votes
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.gift_options go
    where go.id = gift_option_id
      and public.can_access_event_data(go.event_id)
  )
);

drop policy if exists expenses_select_participants on public.expenses;
create policy expenses_select_participants on public.expenses
for select
using (public.can_access_event_data(event_id));

drop policy if exists expense_shares_select_participants on public.expense_shares;
create policy expense_shares_select_participants on public.expense_shares
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.expenses ex
    where ex.id = expense_id
      and public.can_access_event_data(ex.event_id)
  )
);

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists activity_logs_select_participants on public.activity_logs;
create policy activity_logs_select_participants on public.activity_logs
for select
using (public.can_access_event_data(event_id));

drop policy if exists activity_logs_insert_participants on public.activity_logs;
create policy activity_logs_insert_participants on public.activity_logs
for insert
with check (public.can_access_event_data(event_id) and actor_user_id = auth.uid());
create or replace function public.accept_group_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select gi.group_id
    into v_group_id
  from public.group_invites gi
  where gi.token = p_token
    and gi.revoked_at is null
  limit 1;

  if v_group_id is null then
    raise exception 'Invitation not found';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

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
           'message', 'Se creo un nuevo evento secreto en tu grupo.'
         )
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> auth.uid()
    and gm.user_id <> p_birthday_user_id;

  return v_event_id;
end;
$$;

create or replace function public.create_expense_with_shares(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_amount numeric,
  p_paid_by_user_id uuid,
  p_reimbursement_destination_id uuid,
  p_receipt_path text,
  p_participant_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_count int;
  v_base numeric(12,2);
  v_running numeric(12,2) := 0;
  v_participant uuid;
  v_index int := 0;
  v_event_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_paid_by_user_id <> auth.uid() then
    raise exception 'You can only create expenses paid by yourself';
  end if;

  if not public.can_access_event_data(p_event_id) then
    raise exception 'You are not a participant of this event';
  end if;

  v_count := coalesce(array_length(p_participant_ids, 1), 0);
  if v_count = 0 then
    raise exception 'At least one participant is required';
  end if;

  perform 1
  from unnest(p_participant_ids) as participant_id
  where not exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
      and ep.user_id = participant_id
  );

  if found then
    raise exception 'All participants must belong to the event';
  end if;

  insert into public.expenses (
    event_id,
    title,
    description,
    category,
    amount,
    paid_by_user_id,
    reimbursement_destination_id,
    receipt_path,
    created_by_user_id
  )
  values (
    p_event_id,
    p_title,
    p_description,
    p_category,
    p_amount,
    p_paid_by_user_id,
    p_reimbursement_destination_id,
    p_receipt_path,
    auth.uid()
  )
  returning id into v_expense_id;

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
           'message', 'Se registro un nuevo gasto en tu evento.'
         )
  from unnest(p_participant_ids) as participant_id
  where participant_id <> auth.uid();

  return v_expense_id;
end;
$$;

create or replace function public.get_share_payment_details(p_share_id uuid)
returns table (
  share_id uuid,
  event_id uuid,
  expense_title text,
  amount_due numeric,
  status text,
  destination_type text,
  destination_bank_name text,
  destination_account_holder text,
  destination_value text,
  destination_note text,
  can_review boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.expense_shares es
    join public.expenses ex on ex.id = es.expense_id
    join public.birthday_events be on be.id = ex.event_id
    where es.id = p_share_id
      and (
        es.user_id = auth.uid()
        or ex.paid_by_user_id = auth.uid()
        or be.organizer_id = auth.uid()
      )
  ) then
    raise exception 'You cannot access this share';
  end if;

  return query
  select es.id,
         ex.event_id,
         ex.title,
         es.amount_due,
         es.status,
         pd.type,
         pd.bank_name,
         pd.account_holder,
         pd.destination_value,
         pd.note,
         (ex.paid_by_user_id = auth.uid() or be.organizer_id = auth.uid()) as can_review
  from public.expense_shares es
  join public.expenses ex on ex.id = es.expense_id
  join public.birthday_events be on be.id = ex.event_id
  left join public.payment_destinations pd on pd.id = ex.reimbursement_destination_id
  where es.id = p_share_id;
end;
$$;

create or replace function public.report_share_payment(p_share_id uuid, p_note text, p_proof_path text)
returns public.expense_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.expense_shares;
  v_payer uuid;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.expense_shares es
    where es.id = p_share_id
      and es.user_id = auth.uid()
  ) then
    raise exception 'You can only report your own share';
  end if;

  update public.expense_shares
  set status = 'reported_paid',
      note = coalesce(p_note, note),
      proof_path = coalesce(p_proof_path, proof_path),
      reported_paid_at = now()
  where id = p_share_id
  returning * into v_share;

  select ex.paid_by_user_id, ex.event_id
    into v_payer, v_event_id
  from public.expenses ex
  where ex.id = v_share.expense_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_payer,
    'comprobante_subido',
    jsonb_build_object(
      'share_id', p_share_id,
      'event_id', v_event_id,
      'message', 'Un participante reporto su pago y subio comprobante.'
    )
  );

  return v_share;
end;
$$;

create or replace function public.set_share_review(p_share_id uuid, p_action text)
returns public.expense_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.expense_shares;
  v_user uuid;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('confirmed', 'rejected') then
    raise exception 'Unsupported review action';
  end if;

  if not public.event_is_reviewable_by_me(p_share_id) then
    raise exception 'You cannot review this share';
  end if;

  update public.expense_shares
  set status = p_action,
      confirmed_at = case when p_action = 'confirmed' then now() else null end,
      confirmed_by_user_id = auth.uid()
  where id = p_share_id
  returning * into v_share;

  select es.user_id, ex.event_id
    into v_user, v_event_id
  from public.expense_shares es
  join public.expenses ex on ex.id = es.expense_id
  where es.id = p_share_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_user,
    case when p_action = 'confirmed' then 'pago_confirmado' else 'pago_rechazado' end,
    jsonb_build_object(
      'share_id', p_share_id,
      'event_id', v_event_id,
      'message', case when p_action = 'confirmed' then 'Tu pago fue confirmado.' else 'Tu pago fue rechazado y requiere correccion.' end
    )
  );

  return v_share;
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

      insert into public.event_participants (event_id, user_id, role)
      values (v_event_id, v_organizer, 'organizer');

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
               'message', 'Se creo automaticamente un nuevo evento secreto.'
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

grant execute on function public.accept_group_invite(text) to authenticated;
grant execute on function public.create_manual_birthday_event(uuid, uuid) to authenticated;
grant execute on function public.create_expense_with_shares(uuid, text, text, text, numeric, uuid, uuid, text, uuid[]) to authenticated;
grant execute on function public.get_share_payment_details(uuid) to authenticated;
grant execute on function public.report_share_payment(uuid, text, text) to authenticated;
grant execute on function public.set_share_review(uuid, text) to authenticated;

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('expense-receipts', 'expense-receipts', false)
  on conflict (id) do nothing;

  insert into storage.buckets (id, name, public)
  values ('payment-proofs', 'payment-proofs', false)
  on conflict (id) do nothing;
end $$;

drop policy if exists expense_receipts_upload on storage.objects;
create policy expense_receipts_upload on storage.objects
for insert
with check (
  bucket_id = 'expense-receipts'
  and auth.uid() is not null
  and public.can_access_event_data((split_part(name, '/', 2))::uuid)
);

drop policy if exists expense_receipts_select on storage.objects;
create policy expense_receipts_select on storage.objects
for select
using (
  bucket_id = 'expense-receipts'
  and auth.uid() is not null
  and public.can_access_event_data((split_part(name, '/', 2))::uuid)
);

drop policy if exists payment_proofs_upload on storage.objects;
create policy payment_proofs_upload on storage.objects
for insert
with check (
  bucket_id = 'payment-proofs'
  and auth.uid() is not null
  and exists (
    select 1
    from public.expense_shares es
    where es.id = (split_part(name, '/', 2))::uuid
      and es.user_id = auth.uid()
  )
);

drop policy if exists payment_proofs_select on storage.objects;
create policy payment_proofs_select on storage.objects
for select
using (
  bucket_id = 'payment-proofs'
  and auth.uid() is not null
  and (
    exists (
      select 1
      from public.expense_shares es
      where es.id = (split_part(name, '/', 2))::uuid
        and es.user_id = auth.uid()
    )
    or public.event_is_reviewable_by_me((split_part(name, '/', 2))::uuid)
  )
);
