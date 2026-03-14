-- Create a function to manually sync wishlist items into an event
create or replace function public.sync_event_wishlist(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birthday_user_id uuid;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select birthday_user_id into v_birthday_user_id
  from public.birthday_events
  where id = p_event_id;

  if v_birthday_user_id is null then
    raise exception 'Event not found';
  end if;

  -- Insert only those that aren't already there (by wishlist_item_id)
  insert into public.gift_options (
    event_id, source_type, wishlist_item_id, title, url, notes, price_estimate, proposed_by, status
  )
  select
    p_event_id,
    'wishlist',
    id,
    title,
    url,
    notes,
    price_estimate,
    auth.uid(),
    'proposed'
  from public.wishlist_items
  where user_id = v_birthday_user_id
    and id not in (
      select wishlist_item_id 
      from public.gift_options 
      where event_id = p_event_id 
        and wishlist_item_id is not null
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.sync_event_wishlist(uuid) to authenticated;
