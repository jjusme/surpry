create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.birthday_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.event_messages enable row level security;

-- Policy to allow only event participants (excluding the birthday user) to read messages
create policy event_messages_select_participants on public.event_messages
for select
using (public.can_access_event_data(event_id));

-- Policy to allow participants to send messages
create policy event_messages_insert_participants on public.event_messages
for insert
with check (public.can_access_event_data(event_id) and user_id = auth.uid());
