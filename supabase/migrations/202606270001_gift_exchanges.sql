-- =====================================================
-- Gift Exchanges (Intercambio navideño / amigo secreto)
-- 1-to-1 secret gift exchange within a group. Reuses wishlists + profiles + AI.
-- Each participant sees ONLY who they give to (secrecy enforced by RLS).
-- =====================================================

-- ---------- Tables ----------
create table if not exists public.gift_exchanges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null default 'Intercambio',
  description text,
  budget numeric(12,2),
  exchange_date date,
  status text not null default 'open' check (status in ('open', 'drawn', 'closed')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  drawn_at timestamptz
);

create table if not exists public.exchange_participants (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.gift_exchanges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  has_purchased boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (exchange_id, user_id)
);

create table if not exists public.exchange_assignments (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.gift_exchanges(id) on delete cascade,
  giver_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (exchange_id, giver_id),
  unique (exchange_id, receiver_id)
);

create table if not exists public.exchange_exclusions (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.gift_exchanges(id) on delete cascade,
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.gift_exchanges enable row level security;
alter table public.exchange_participants enable row level security;
alter table public.exchange_assignments enable row level security;
alter table public.exchange_exclusions enable row level security;

-- ---------- Helper ----------
create or replace function public.can_manage_exchange(p_exchange_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.gift_exchanges ge
    where ge.id = p_exchange_id
      and (ge.created_by = auth.uid() or public.is_group_admin(ge.group_id))
  );
$$;

-- ---------- RLS: gift_exchanges ----------
drop policy if exists gift_exchanges_select_members on public.gift_exchanges;
create policy gift_exchanges_select_members on public.gift_exchanges
for select using (public.is_group_member(group_id));

drop policy if exists gift_exchanges_insert_member on public.gift_exchanges;
create policy gift_exchanges_insert_member on public.gift_exchanges
for insert with check (created_by = auth.uid() and public.is_group_member(group_id));

drop policy if exists gift_exchanges_update_manager on public.gift_exchanges;
create policy gift_exchanges_update_manager on public.gift_exchanges
for update using (created_by = auth.uid() or public.is_group_admin(group_id))
with check (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists gift_exchanges_delete_manager on public.gift_exchanges;
create policy gift_exchanges_delete_manager on public.gift_exchanges
for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

-- ---------- RLS: exchange_participants ----------
drop policy if exists exchange_participants_select on public.exchange_participants;
create policy exchange_participants_select on public.exchange_participants
for select using (
  exists (
    select 1 from public.gift_exchanges ge
    where ge.id = exchange_id and public.is_group_member(ge.group_id)
  )
);

drop policy if exists exchange_participants_join on public.exchange_participants;
create policy exchange_participants_join on public.exchange_participants
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.gift_exchanges ge
    where ge.id = exchange_id and ge.status = 'open' and public.is_group_member(ge.group_id)
  )
);

-- Self can update own row (e.g. has_purchased); managers can update any row in their exchange.
drop policy if exists exchange_participants_update on public.exchange_participants;
create policy exchange_participants_update on public.exchange_participants
for update using (user_id = auth.uid() or public.can_manage_exchange(exchange_id))
with check (user_id = auth.uid() or public.can_manage_exchange(exchange_id));

-- Self can leave while open; managers can remove anyone while open.
drop policy if exists exchange_participants_leave on public.exchange_participants;
create policy exchange_participants_leave on public.exchange_participants
for delete using (
  (user_id = auth.uid() or public.can_manage_exchange(exchange_id))
  and exists (
    select 1 from public.gift_exchanges ge where ge.id = exchange_id and ge.status = 'open'
  )
);

-- ---------- RLS: exchange_assignments (THE SECRET) ----------
-- A participant can see ONLY their own assignment (who they give to). No one — not
-- even the organizer — sees the full map. Writes happen only via the draw function.
drop policy if exists exchange_assignments_select_own on public.exchange_assignments;
create policy exchange_assignments_select_own on public.exchange_assignments
for select using (giver_id = auth.uid());

-- ---------- RLS: exchange_exclusions ----------
drop policy if exists exchange_exclusions_select on public.exchange_exclusions;
create policy exchange_exclusions_select on public.exchange_exclusions
for select using (
  exists (
    select 1 from public.gift_exchanges ge
    where ge.id = exchange_id and public.is_group_member(ge.group_id)
  )
);

drop policy if exists exchange_exclusions_manage_insert on public.exchange_exclusions;
create policy exchange_exclusions_manage_insert on public.exchange_exclusions
for insert with check (
  public.can_manage_exchange(exchange_id)
  and exists (select 1 from public.gift_exchanges ge where ge.id = exchange_id and ge.status = 'open')
);

drop policy if exists exchange_exclusions_manage_delete on public.exchange_exclusions;
create policy exchange_exclusions_manage_delete on public.exchange_exclusions
for delete using (public.can_manage_exchange(exchange_id));

-- ---------- Function: create exchange ----------
create or replace function public.create_gift_exchange(
  p_group_id uuid,
  p_name text,
  p_budget numeric default null,
  p_exchange_date date default null,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group';
  end if;

  insert into public.gift_exchanges (group_id, name, description, budget, exchange_date, created_by)
  values (p_group_id, coalesce(nullif(p_name, ''), 'Intercambio'), p_description, p_budget, p_exchange_date, auth.uid())
  returning id into v_id;

  -- the creator joins automatically
  insert into public.exchange_participants (exchange_id, user_id)
  values (v_id, auth.uid());

  return v_id;
end;
$$;

-- ---------- Function: draw (single-cycle derangement honoring exclusions) ----------
create or replace function public.draw_gift_exchange(p_exchange_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group_id uuid;
  v_status text;
  v_name text;
  v_ids uuid[];
  v_n int;
  v_attempt int := 0;
  v_ok boolean;
  i int;
  v_giver uuid;
  v_receiver uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select group_id, status, name into v_group_id, v_status, v_name
  from public.gift_exchanges where id = p_exchange_id;

  if v_group_id is null then raise exception 'Exchange not found'; end if;
  if not public.can_manage_exchange(p_exchange_id) then
    raise exception 'Solo el organizador o un admin del grupo puede sortear';
  end if;
  if v_status <> 'open' then raise exception 'El intercambio ya fue sorteado'; end if;

  select array_agg(user_id) into v_ids
  from public.exchange_participants where exchange_id = p_exchange_id;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < 3 then raise exception 'Se necesitan al menos 3 participantes'; end if;

  -- Try random single-cycle rotations until one respects all exclusions.
  loop
    v_attempt := v_attempt + 1;

    select array_agg(x order by random()) into v_ids
    from unnest(v_ids) as x;

    v_ok := true;
    for i in 1..v_n loop
      v_giver := v_ids[i];
      v_receiver := v_ids[(i % v_n) + 1];
      if exists (
        select 1 from public.exchange_exclusions ee
        where ee.exchange_id = p_exchange_id
          and ((ee.user_a = v_giver and ee.user_b = v_receiver)
            or (ee.user_a = v_receiver and ee.user_b = v_giver))
      ) then
        v_ok := false;
        exit;
      end if;
    end loop;

    exit when v_ok;

    if v_attempt >= 300 then
      raise exception 'No se pudo sortear con las exclusiones dadas. Quita alguna restricción e intenta de nuevo.';
    end if;
  end loop;

  -- Persist the chosen rotation.
  for i in 1..v_n loop
    insert into public.exchange_assignments (exchange_id, giver_id, receiver_id)
    values (p_exchange_id, v_ids[i], v_ids[(i % v_n) + 1]);
  end loop;

  update public.gift_exchanges
  set status = 'drawn', drawn_at = now()
  where id = p_exchange_id;

  insert into public.notifications (user_id, type, payload)
  select ep.user_id, 'intercambio_sorteado',
         jsonb_build_object(
           'exchange_id', p_exchange_id,
           'message', '¡El sorteo de "' || v_name || '" ya está listo! Descubre a quién le toca regalarte... digo, a quién le regalas 🎁'
         )
  from public.exchange_participants ep
  where ep.exchange_id = p_exchange_id;
end;
$$;

-- ---------- Function: reset (re-open to draw again) ----------
create or replace function public.reset_gift_exchange(p_exchange_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_manage_exchange(p_exchange_id) then
    raise exception 'Solo el organizador o un admin puede reiniciar el sorteo';
  end if;

  delete from public.exchange_assignments where exchange_id = p_exchange_id;
  update public.exchange_participants set has_purchased = false where exchange_id = p_exchange_id;
  update public.gift_exchanges set status = 'open', drawn_at = null where id = p_exchange_id;
end;
$$;

grant execute on function public.create_gift_exchange(uuid, text, numeric, date, text) to authenticated;
grant execute on function public.draw_gift_exchange(uuid) to authenticated;
grant execute on function public.reset_gift_exchange(uuid) to authenticated;
grant execute on function public.can_manage_exchange(uuid) to authenticated;
