-- Fix RLS for groups: allow the creator to select the group even if they are not yet a member
-- This is necessary for the initial creation flow where .insert().select() is used.

drop policy if exists groups_select_creator on public.groups;
create policy groups_select_creator on public.groups
for select
using (created_by = auth.uid());

-- Also ensure members can select their groups (already exists but keeping for clarity)
-- drop policy if exists groups_select_members on public.groups;
-- create policy groups_select_members on public.groups
-- for select
-- using (public.is_group_member(id));

-- Fix RLS for group_members: ensure the creator can add themselves as the first member
drop policy if exists group_members_insert_creator on public.group_members;
create policy group_members_insert_creator on public.group_members
for insert
with check (
  user_id = auth.uid() 
  and exists (
    select 1 from public.groups 
    where id = group_id 
    and created_by = auth.uid()
  )
);
