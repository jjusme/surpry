-- Add deletion functions for groups and events

-- DELETE EVENT
create or replace function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only organizer or group owner can delete
  if not exists (
    select 1 from public.birthday_events be
    join public.groups g on g.id = be.group_id
    where be.id = p_event_id
      and (be.organizer_id = auth.uid() or g.created_by = auth.uid())
  ) then
    raise exception 'Unauthorized to delete this event';
  end if;

  -- Delete the event record (cascading will handle related tables)
  delete from public.birthday_events where id = p_event_id;
end;
$$;

-- DELETE GROUP
create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only owner can delete
  if not exists (
    select 1 from public.groups
    where id = p_group_id and created_by = auth.uid()
  ) then
    raise exception 'Unauthorized to delete this group';
  end if;

  -- Delete the group record (cascading will handle members, events, etc.)
  delete from public.groups where id = p_group_id;
end;
$$;

grant execute on function public.delete_event(uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
