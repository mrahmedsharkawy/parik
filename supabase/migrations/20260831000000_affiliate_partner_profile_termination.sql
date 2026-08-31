-- Keep affiliate financial history while allowing either an admin or the
-- partner to end the commercial relationship safely.
alter table public.affiliate_partners
  drop constraint if exists affiliate_partners_status_check;

alter table public.affiliate_partners
  add constraint affiliate_partners_status_check
  check (status in ('pending','active','suspended','rejected','terminated'));

alter table public.affiliate_partners
  add column if not exists terminated_at timestamptz,
  add column if not exists termination_reason text not null default '';

create or replace function public.affiliate_update_profile(p_payload jsonb)
returns public.affiliate_partners
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  partner public.affiliate_partners;
begin
  if uid is null then raise exception 'authentication_required'; end if;

  update public.affiliate_partners
  set
    full_name = left(trim(coalesce(p_payload->>'full_name', full_name)), 160),
    account_name = left(trim(coalesce(p_payload->>'account_name', account_name)), 160),
    phone = left(trim(coalesce(p_payload->>'phone', phone)), 40),
    emirate = left(trim(coalesce(p_payload->>'emirate', emirate)), 100),
    instagram = left(trim(coalesce(p_payload->>'instagram', instagram)), 250),
    tiktok = left(trim(coalesce(p_payload->>'tiktok', tiktok)), 250),
    other_social = left(trim(coalesce(p_payload->>'other_social', other_social)), 500),
    marketing_method = left(trim(coalesce(p_payload->>'marketing_method', marketing_method)), 1000),
    payout_method = nullif(left(trim(coalesce(p_payload->>'payout_method', payout_method)), 80), ''),
    payout_details = case
      when jsonb_typeof(p_payload->'payout_details') = 'object' then p_payload->'payout_details'
      else payout_details
    end,
    updated_at = now()
  where user_id = uid and status <> 'terminated'
  returning * into partner;

  if partner.id is null then raise exception 'partner_not_editable'; end if;
  if partner.full_name = '' or partner.account_name = '' or partner.phone = '' then
    raise exception 'required_profile_fields';
  end if;

  insert into public.affiliate_audit_log(actor_user_id, partner_id, action, entity_type, entity_id, new_data)
  values(uid, partner.id, 'partner_profile_updated', 'partner', partner.id::text,
    jsonb_build_object('account_name', partner.account_name, 'phone', partner.phone));
  return partner;
end $$;

revoke all on function public.affiliate_update_profile(jsonb) from public;
grant execute on function public.affiliate_update_profile(jsonb) to authenticated;

create or replace function public.affiliate_terminate_contract(p_reason text default '')
returns public.affiliate_partners
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  partner public.affiliate_partners;
begin
  if uid is null then raise exception 'authentication_required'; end if;

  update public.affiliate_partners
  set status = 'terminated',
      terminated_at = now(),
      termination_reason = left(trim(coalesce(p_reason, '')), 1000),
      updated_at = now()
  where user_id = uid and status <> 'terminated'
  returning * into partner;

  if partner.id is null then raise exception 'partner_not_active'; end if;

  insert into public.affiliate_audit_log(actor_user_id, partner_id, action, entity_type, entity_id, new_data)
  values(uid, partner.id, 'partner_contract_terminated', 'partner', partner.id::text,
    jsonb_build_object('reason', partner.termination_reason, 'terminated_at', partner.terminated_at));
  return partner;
end $$;

revoke all on function public.affiliate_terminate_contract(text) from public;
grant execute on function public.affiliate_terminate_contract(text) to authenticated;

