-- Fix can_review logic in get_share_payment_details
-- It should only be true if the status is 'reported_paid'
drop function if exists public.get_share_payment_details(uuid);
create or replace function public.get_share_payment_details(p_share_id uuid)
returns table(
  id uuid,
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
         (
           (ex.paid_by_user_id = auth.uid() or be.organizer_id = auth.uid()) 
           and es.status = 'reported_paid'
         ) as can_review
  from public.expense_shares es
  join public.expenses ex on ex.id = es.expense_id
  join public.birthday_events be on be.id = ex.event_id
  left join public.payment_destinations pd on pd.id = ex.reimbursement_destination_id
  where es.id = p_share_id;
end;
$$;

-- Ensure RLS allows selecting these even after confirmation
-- (Should be handled by existing policies but good to verify)
