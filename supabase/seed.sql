-- Seed base para entorno local.
-- Reemplaza los UUID por usuarios reales de auth.users antes de ejecutar.

insert into public.profiles (id, display_name, birthday_day, birthday_month)
values
  ('11111111-1111-1111-1111-111111111111', 'Ana Lopez', 15, 10),
  ('22222222-2222-2222-2222-222222222222', 'Carlos Ruiz', 22, 11),
  ('33333333-3333-3333-3333-333333333333', 'Sofia Mora', 5, 12)
on conflict (id) do nothing;

insert into public.groups (id, name, created_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Amigos cercanos', '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member')
on conflict (group_id, user_id) do nothing;
