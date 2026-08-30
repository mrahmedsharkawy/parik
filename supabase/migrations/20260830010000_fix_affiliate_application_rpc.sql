-- Fix partner applications on projects where pgcrypto is installed outside public.
create or replace function public.affiliate_generate_code(p_name text) returns text
language plpgsql security definer set search_path='' as $$
declare base text; candidate text;
begin
  base := upper(regexp_replace(coalesce(p_name,'PARTNER'),'[^A-Za-z0-9]','','g'));
  if length(base)<3 then base := 'BARIQ'; end if;
  base := left(base,8);
  loop
    candidate := base || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
    exit when not exists(select 1 from public.affiliate_partners where partner_code=candidate);
  end loop;
  return candidate;
end $$;
revoke all on function public.affiliate_generate_code(text) from public;

create or replace function public.affiliate_record_click(
  p_code text,
  p_session_key text,
  p_product_id text default null,
  p_source text default 'link',
  p_landing_path text default ''
) returns uuid
language plpgsql security definer set search_path='' as $$
declare partner public.affiliate_partners; settings public.affiliate_settings; ref_id uuid; session_digest text;
begin
  if length(trim(coalesce(p_session_key,'')))<12 then raise exception 'invalid_session'; end if;
  select * into partner from public.affiliate_partners where partner_code=upper(trim(p_code)) and status='active';
  if partner.id is null then return null; end if;
  select * into settings from public.affiliate_settings where id=true and enabled=true;
  if settings.id is null then return null; end if;
  session_digest := md5(p_session_key);
  insert into public.affiliate_referrals(partner_id,product_id,session_hash,source,landing_path,expires_at)
  values(partner.id,nullif(p_product_id,''),session_digest,left(coalesce(p_source,'link'),40),left(coalesce(p_landing_path,''),500),now()+make_interval(days=>settings.attribution_days))
  on conflict(partner_id,session_hash) do update set
    product_id=coalesce(excluded.product_id,public.affiliate_referrals.product_id),
    source=excluded.source,
    landing_path=excluded.landing_path,
    expires_at=excluded.expires_at
  returning id into ref_id;
  return ref_id;
end $$;
revoke all on function public.affiliate_record_click(text,text,text,text,text) from public;
grant execute on function public.affiliate_record_click(text,text,text,text,text) to anon,authenticated;
