-- Bariq affiliate platform: isolated from customer cashback and customer wallet.
create extension if not exists pgcrypto;

create table if not exists public.affiliate_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  default_commission_rate numeric(5,2) not null default 10 check (default_commission_rate between 0 and 100),
  attribution_days integer not null default 30 check (attribution_days between 1 and 365),
  minimum_withdrawal numeric(12,2) not null default 100 check (minimum_withdrawal >= 0),
  allowed_payout_methods text[] not null default array['bank_transfer','cash'],
  terms_version text not null default '1.0',
  updated_at timestamptz not null default now()
);
insert into public.affiliate_settings(id) values(true) on conflict (id) do nothing;

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  partner_code text not null unique,
  full_name text not null,
  account_name text not null,
  email text not null,
  phone text not null,
  emirate text not null default '',
  instagram text not null default '',
  tiktok text not null default '',
  other_social text not null default '',
  marketing_method text not null default '',
  notes text not null default '',
  avatar_url text not null default '',
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  level text not null default 'partner',
  commission_override numeric(5,2) check (commission_override between 0 and 100),
  payout_method text,
  payout_details jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete cascade,
  product_id text,
  session_hash text not null,
  source text not null default 'link',
  landing_path text not null default '',
  expires_at timestamptz not null,
  converted_at timestamptz,
  order_number text,
  created_at timestamptz not null default now(),
  unique(partner_id, session_hash)
);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete restrict,
  referral_id uuid references public.affiliate_referrals(id) on delete set null,
  order_id text not null,
  order_number text not null,
  eligible_amount numeric(12,2) not null check (eligible_amount >= 0),
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','available','paid','cancelled')),
  confirmed_at timestamptz,
  available_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_number),
  unique(order_id)
);

create table if not exists public.affiliate_withdrawals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payout_method text not null,
  payout_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  admin_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete restrict,
  commission_id uuid references public.affiliate_commissions(id) on delete restrict,
  withdrawal_id uuid references public.affiliate_withdrawals(id) on delete restrict,
  entry_type text not null check (entry_type in ('commission_available','commission_reversal','withdrawal_hold','withdrawal_release','payout','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists affiliate_ledger_commission_available_uq on public.affiliate_ledger(commission_id,entry_type) where commission_id is not null and entry_type='commission_available';
create unique index if not exists affiliate_ledger_commission_reversal_uq on public.affiliate_ledger(commission_id,entry_type) where commission_id is not null and entry_type='commission_reversal';
create unique index if not exists affiliate_ledger_withdrawal_hold_uq on public.affiliate_ledger(withdrawal_id,entry_type) where withdrawal_id is not null and entry_type='withdrawal_hold';
create unique index if not exists affiliate_ledger_withdrawal_release_uq on public.affiliate_ledger(withdrawal_id,entry_type) where withdrawal_id is not null and entry_type='withdrawal_release';

create table if not exists public.affiliate_marketing_assets (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  asset_type text not null check (asset_type in ('image','video','copy','short_description')),
  title_ar text not null default '',
  title_en text not null default '',
  content_ar text not null default '',
  content_en text not null default '',
  media_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ar text not null,
  title_en text not null,
  body_ar text not null,
  body_en text not null,
  icon text not null default 'description',
  published boolean not null default true,
  sort_order integer not null default 0,
  version text not null default '1.0',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  partner_id uuid references public.affiliate_partners(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists affiliate_enabled boolean not null default true;
alter table public.products add column if not exists affiliate_commission_rate numeric(5,2) check (affiliate_commission_rate between 0 and 100);
alter table public.orders add column if not exists affiliate_referral_id uuid references public.affiliate_referrals(id) on delete set null;
alter table public.orders add column if not exists affiliate_partner_id uuid references public.affiliate_partners(id) on delete set null;

create index if not exists affiliate_partners_status_idx on public.affiliate_partners(status,created_at desc);
create index if not exists affiliate_referrals_partner_created_idx on public.affiliate_referrals(partner_id,created_at desc);
create index if not exists affiliate_referrals_expiry_idx on public.affiliate_referrals(expires_at) where converted_at is null;
create index if not exists affiliate_commissions_partner_status_idx on public.affiliate_commissions(partner_id,status,created_at desc);
create index if not exists affiliate_withdrawals_partner_status_idx on public.affiliate_withdrawals(partner_id,status,created_at desc);
create index if not exists affiliate_ledger_partner_created_idx on public.affiliate_ledger(partner_id,created_at desc);
create index if not exists affiliate_assets_product_idx on public.affiliate_marketing_assets(product_id,active,sort_order);
create index if not exists orders_affiliate_partner_idx on public.orders(affiliate_partner_id,created_at desc) where affiliate_partner_id is not null;

insert into public.store_policies(slug,title_ar,title_en,body_ar,body_en,icon,sort_order) values
('privacy','سياسة الخصوصية','Privacy Policy','نحمي بياناتك ونستخدمها فقط لتقديم الخدمة وتحسينها وفق القوانين المعمول بها.','We protect your data and use it only to provide and improve the service under applicable laws.','privacy_tip',10),
('terms','الشروط والأحكام','Terms & Conditions','باستخدام بريق فإنك توافق على شروط الطلب والدفع والتخصيص الموضحة وقت الشراء.','By using Bariq you agree to the ordering, payment and customization terms shown at purchase.','gavel',20),
('shipping','سياسة الشحن والتوصيل','Shipping & Delivery','تختلف مدة وتكلفة التوصيل حسب المنتج والتخصيص والعنوان، ويتم تأكيدها مع الطلب.','Delivery time and cost vary by product, customization and destination and are confirmed with the order.','local_shipping',30),
('returns','سياسة الاستبدال والاسترجاع','Returns & Exchanges','تخضع المنتجات المخصصة لشروط خاصة، وتتم مراجعة طلبات الاستبدال والاسترجاع حسب حالة المنتج.','Customized products have special terms; return and exchange requests are reviewed according to product condition.','assignment_return',40),
('payment','سياسة الدفع','Payment Policy','تظهر وسائل الدفع المتاحة عند الطلب، ولا يعتبر الطلب مدفوعًا قبل تأكيد العملية.','Available payment methods are shown during ordering; an order is not paid until payment is confirmed.','payments',50),
('affiliate','سياسة برنامج شركاء بريق','Bariq Partner Program Policy','تُحتسب العمولة للطلبات المؤهلة فقط، وتصبح متاحة بعد اكتمال الطلب وفق قواعد البرنامج. يمنع التحايل والإحالة الذاتية والطلبات الوهمية.','Commission applies only to eligible orders and becomes available after order completion under program rules. Fraud, self-referral and fake orders are prohibited.','handshake',60)
on conflict(slug) do nothing;

create or replace function public.affiliate_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.erp_users u
    where u.user_id=(select auth.uid()) and u.active=true and u.role in ('owner','admin')
  );
$$;
revoke all on function public.affiliate_is_admin() from public;
grant execute on function public.affiliate_is_admin() to authenticated;

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

create or replace function public.affiliate_apply(p_payload jsonb) returns public.affiliate_partners
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); row_out public.affiliate_partners; mail text;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select email into mail from auth.users where id=uid;
  insert into public.affiliate_partners(user_id,partner_code,full_name,account_name,email,phone,emirate,instagram,tiktok,other_social,marketing_method,notes)
  values(uid,public.affiliate_generate_code(p_payload->>'account_name'),trim(p_payload->>'full_name'),trim(p_payload->>'account_name'),coalesce(nullif(trim(p_payload->>'email'),''),mail),trim(p_payload->>'phone'),coalesce(p_payload->>'emirate',''),coalesce(p_payload->>'instagram',''),coalesce(p_payload->>'tiktok',''),coalesce(p_payload->>'other_social',''),coalesce(p_payload->>'marketing_method',''),coalesce(p_payload->>'notes',''))
  on conflict(user_id) do update set
    full_name=excluded.full_name, account_name=excluded.account_name, phone=excluded.phone,
    emirate=excluded.emirate, instagram=excluded.instagram, tiktok=excluded.tiktok,
    other_social=excluded.other_social, marketing_method=excluded.marketing_method,
    notes=excluded.notes, updated_at=now()
  returning * into row_out;
  insert into public.affiliate_audit_log(actor_user_id,partner_id,action,entity_type,entity_id,new_data)
  values(uid,row_out.id,'partner_application','partner',row_out.id::text,to_jsonb(row_out));
  return row_out;
end $$;
revoke all on function public.affiliate_apply(jsonb) from public;
grant execute on function public.affiliate_apply(jsonb) to authenticated;

create or replace function public.affiliate_record_click(p_code text,p_session_key text,p_product_id text default null,p_source text default 'link',p_landing_path text default '') returns uuid
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
  on conflict(partner_id,session_hash) do update set product_id=coalesce(excluded.product_id,public.affiliate_referrals.product_id),source=excluded.source,landing_path=excluded.landing_path,expires_at=excluded.expires_at
  returning id into ref_id;
  return ref_id;
end $$;
revoke all on function public.affiliate_record_click(text,text,text,text,text) from public;
grant execute on function public.affiliate_record_click(text,text,text,text,text) to anon,authenticated;

create or replace function public.affiliate_available_balance(p_partner uuid) returns numeric
language sql stable security invoker set search_path='' as $$
  select coalesce(sum(case when direction='credit' then amount else -amount end),0)
  from public.affiliate_ledger where partner_id=p_partner;
$$;

create or replace function public.affiliate_dashboard() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.affiliate_partners; result jsonb;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select * into p from public.affiliate_partners where user_id=uid;
  if p.id is null then return jsonb_build_object('partner',null); end if;
  select jsonb_build_object(
    'partner',to_jsonb(p),
    'total_sales',coalesce(sum(c.eligible_amount) filter(where c.status<>'cancelled'),0),
    'total_earnings',coalesce(sum(c.commission_amount) filter(where c.status<>'cancelled'),0),
    'available_earnings',public.affiliate_available_balance(p.id),
    'pending_earnings',coalesce(sum(c.commission_amount) filter(where c.status in ('pending','confirmed')),0),
    'paid_earnings',(select coalesce(sum(w.amount),0) from public.affiliate_withdrawals w where w.partner_id=p.id and w.status='paid'),
    'order_count',count(c.id) filter(where c.status<>'cancelled'),
    'customer_count',count(distinct c.order_number) filter(where c.status<>'cancelled'),
    'click_count',(select count(*) from public.affiliate_referrals r where r.partner_id=p.id),
    'conversion_rate',case when (select count(*) from public.affiliate_referrals r where r.partner_id=p.id)>0 then round((count(c.id) filter(where c.status<>'cancelled'))::numeric*100/(select count(*) from public.affiliate_referrals r where r.partner_id=p.id),2) else 0 end
  ) into result from public.affiliate_commissions c where c.partner_id=p.id;
  return result;
end $$;
revoke all on function public.affiliate_dashboard() from public;
grant execute on function public.affiliate_dashboard() to authenticated;

create or replace function public.affiliate_request_withdrawal(p_amount numeric,p_method text,p_details jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.affiliate_partners; s public.affiliate_settings; balance numeric; wid uuid;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select * into p from public.affiliate_partners where user_id=uid for update;
  if p.id is null or p.status<>'active' then raise exception 'partner_not_active'; end if;
  select * into s from public.affiliate_settings where id=true;
  if p_amount<s.minimum_withdrawal then raise exception 'below_minimum_withdrawal'; end if;
  if not (p_method=any(s.allowed_payout_methods)) then raise exception 'invalid_payout_method'; end if;
  select public.affiliate_available_balance(p.id) into balance;
  if p_amount>balance then raise exception 'insufficient_balance'; end if;
  insert into public.affiliate_withdrawals(partner_id,amount,payout_method,payout_details) values(p.id,p_amount,p_method,coalesce(p_details,'{}'::jsonb)) returning id into wid;
  insert into public.affiliate_ledger(partner_id,withdrawal_id,entry_type,direction,amount,description,created_by) values(p.id,wid,'withdrawal_hold','debit',p_amount,'Withdrawal request hold',uid);
  insert into public.affiliate_audit_log(actor_user_id,partner_id,action,entity_type,entity_id,new_data) values(uid,p.id,'withdrawal_requested','withdrawal',wid::text,jsonb_build_object('amount',p_amount,'method',p_method));
  return wid;
end $$;
revoke all on function public.affiliate_request_withdrawal(numeric,text,jsonb) from public;
grant execute on function public.affiliate_request_withdrawal(numeric,text,jsonb) to authenticated;

create or replace function public.affiliate_process_order() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.affiliate_referrals; p public.affiliate_partners; default_rate numeric; rate numeric; eligible numeric:=0; commission numeric:=0; raw_commission numeric:=0; oid text; onum text; customer_mail text; customer_phone text;
begin
  if new.affiliate_referral_id is null then return new; end if;
  select * into r from public.affiliate_referrals where id=new.affiliate_referral_id and expires_at>now() and converted_at is null for update;
  if r.id is null then new.affiliate_referral_id:=null; return new; end if;
  select * into p from public.affiliate_partners where id=r.partner_id and status='active';
  if p.id is null then new.affiliate_referral_id:=null; return new; end if;
  customer_mail:=lower(trim(coalesce(new.customer_email,'')));
  if customer_mail<>'' and customer_mail=lower(trim(p.email)) then new.affiliate_referral_id:=null; return new; end if;
  customer_phone:=regexp_replace(coalesce(new.customer_phone,''),'\D','','g');
  if customer_phone<>'' and customer_phone=regexp_replace(coalesce(p.phone,''),'\D','','g') then new.affiliate_referral_id:=null; return new; end if;
  select default_commission_rate into default_rate from public.affiliate_settings where id=true;
  select
    coalesce(sum(least(greatest(coalesce((i.item->>'qty')::numeric,1),1),999)*pr.price),0),
    coalesce(sum(
      least(greatest(coalesce((i.item->>'qty')::numeric,1),1),999)
      * pr.price
      * coalesce(pr.affiliate_commission_rate,p.commission_override,default_rate,0) / 100
    ),0)
  into eligible,raw_commission
  from jsonb_array_elements(coalesce(new.items::jsonb,'[]'::jsonb)) i(item)
  join public.products pr on pr.id::text=coalesce(i.item->>'id',i.item->>'product_id') and pr.active=true and pr.affiliate_enabled=true;
  if eligible>greatest(coalesce(new.total,0),0) and eligible>0 then
    raw_commission:=raw_commission*(greatest(coalesce(new.total,0),0)/eligible);
    eligible:=greatest(coalesce(new.total,0),0);
  end if;
  if eligible<=0 or raw_commission<=0 then new.affiliate_referral_id:=null; return new; end if;
  commission:=round(raw_commission,2);
  rate:=round((commission/eligible)*100,4);
  oid:=coalesce(new.id::text,new.order_number::text); onum:=coalesce(new.order_number::text,oid);
  new.affiliate_partner_id:=p.id;
  insert into public.affiliate_commissions(partner_id,referral_id,order_id,order_number,eligible_amount,commission_rate,commission_amount)
  values(p.id,r.id,oid,onum,eligible,rate,commission) on conflict(order_number) do nothing;
  update public.affiliate_referrals set converted_at=now(),order_number=onum where id=r.id;
  insert into public.notifications(type,icon,title,body,user_id,order_id,url,status,amount,data)
  values('affiliate','🎉','تم تسجيل عملية بيع جديدة من خلالك','العمولة قيد المراجعة حتى اكتمال الطلب.',p.user_id,onum,'/account?section=affiliate','pending',commission,jsonb_build_object('partner_id',p.id,'order_number',onum));
  return new;
exception when others then
  new.affiliate_referral_id:=null; new.affiliate_partner_id:=null; return new;
end $$;

drop trigger if exists affiliate_order_attribution_before_insert on public.orders;
create trigger affiliate_order_attribution_before_insert before insert on public.orders for each row execute function public.affiliate_process_order();

create or replace function public.affiliate_partner_status_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications(type,icon,title,body,user_id,url,status,data)
    values(
      'affiliate','🤝',
      case new.status when 'active' then 'تم قبولك في برنامج شركاء بريق' when 'rejected' then 'تحديث طلب برنامج الشركاء' when 'suspended' then 'تم إيقاف حساب الشريك مؤقتاً' else 'تحديث حساب الشريك' end,
      case new.status when 'active' then 'يمكنك الآن إنشاء روابط المنتجات ومتابعة العمولات.' when 'rejected' then coalesce(nullif(new.rejection_reason,''),'راجع بيانات الطلب أو تواصل مع الدعم.') when 'suspended' then 'تواصل مع الدعم لمعرفة التفاصيل.' else 'تم تحديث حالة حسابك.' end,
      new.user_id,'/account?section=affiliate',new.status,jsonb_build_object('partner_id',new.id,'partner_status',new.status)
    );
  end if;
  return new;
end $$;
drop trigger if exists affiliate_partner_status_after_update on public.affiliate_partners;
create trigger affiliate_partner_status_after_update after update of status on public.affiliate_partners for each row execute function public.affiliate_partner_status_notification();

create or replace function public.affiliate_sync_commission_status() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.affiliate_commissions; target text;
begin
  if new.affiliate_partner_id is null then return new; end if;
  select * into c from public.affiliate_commissions where order_id=new.id::text for update;
  if c.id is null then return new; end if;
  target:=case lower(coalesce(new.status,'')) when 'delivered' then 'available' when 'completed' then 'available' when 'confirmed' then 'confirmed' when 'cancelled' then 'cancelled' when 'canceled' then 'cancelled' when 'returned' then 'cancelled' when 'refunded' then 'cancelled' when 'rejected' then 'cancelled' else c.status end;
  if target=c.status then return new; end if;
  if c.status='cancelled' then return new; end if;
  update public.affiliate_commissions set status=target,confirmed_at=case when target in ('confirmed','available') then coalesce(confirmed_at,now()) else confirmed_at end,available_at=case when target='available' then coalesce(available_at,now()) else available_at end,cancelled_at=case when target='cancelled' then now() else cancelled_at end,updated_at=now() where id=c.id;
  if target='available' then
    insert into public.affiliate_ledger(partner_id,commission_id,entry_type,direction,amount,description) values(c.partner_id,c.id,'commission_available','credit',c.commission_amount,'Commission available for order '||c.order_number) on conflict do nothing;
  elsif target='cancelled' and c.status='available' then
    insert into public.affiliate_ledger(partner_id,commission_id,entry_type,direction,amount,description) values(c.partner_id,c.id,'commission_reversal','debit',c.commission_amount,'Commission reversed for order '||c.order_number) on conflict do nothing;
  end if;
  insert into public.notifications(type,icon,title,body,user_id,order_id,url,status,amount,data)
  select 'affiliate','💰','تحديث عمولة الشريك',
    case target when 'available' then 'أصبحت عمولتك متاحة للسحب.' when 'cancelled' then 'ألغيت العمولة لعدم اكتمال الطلب.' else 'تم تحديث حالة عمولتك.' end,
    p.user_id,c.order_number,'/account?section=affiliate',target,c.commission_amount,
    jsonb_build_object('commission_id',c.id,'commission_status',target)
  from public.affiliate_partners p where p.id=c.partner_id;
  return new;
end $$;
drop trigger if exists affiliate_order_status_after_update on public.orders;
create trigger affiliate_order_status_after_update after update of status on public.orders for each row execute function public.affiliate_sync_commission_status();

create or replace function public.affiliate_withdrawal_status_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status=old.status then return new; end if;
  if old.status='paid' or
     (old.status='pending' and new.status not in ('approved','rejected')) or
     (old.status='approved' and new.status not in ('paid','rejected')) or
     (old.status='rejected') then
    raise exception 'invalid_withdrawal_transition';
  end if;
  if new.status='rejected' then
    insert into public.affiliate_ledger(partner_id,withdrawal_id,entry_type,direction,amount,description,created_by) values(new.partner_id,new.id,'withdrawal_release','credit',new.amount,'Rejected withdrawal released',auth.uid()) on conflict do nothing;
  elsif new.status='paid' then new.paid_at:=coalesce(new.paid_at,now()); end if;
  new.reviewed_at:=now(); new.reviewed_by:=auth.uid(); new.updated_at:=now();
  insert into public.affiliate_audit_log(actor_user_id,partner_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),new.partner_id,'withdrawal_'||new.status,'withdrawal',new.id::text,to_jsonb(old),to_jsonb(new));
  insert into public.notifications(type,icon,title,body,user_id,url,status,amount,data)
  select 'affiliate','💳','تحديث طلب سحب العمولة',
    case new.status when 'approved' then 'تمت الموافقة على طلب السحب.' when 'paid' then 'تم دفع مبلغ العمولة.' when 'rejected' then 'تم رفض طلب السحب وإعادة المبلغ إلى الرصيد المتاح.' else 'تم تحديث طلب السحب.' end,
    p.user_id,'/account?section=affiliate',new.status,new.amount,jsonb_build_object('withdrawal_id',new.id,'withdrawal_status',new.status)
  from public.affiliate_partners p where p.id=new.partner_id;
  return new;
end $$;
drop trigger if exists affiliate_withdrawal_status_before_update on public.affiliate_withdrawals;
create trigger affiliate_withdrawal_status_before_update before update of status on public.affiliate_withdrawals for each row execute function public.affiliate_withdrawal_status_audit();

revoke all on function public.affiliate_available_balance(uuid) from public;
revoke all on function public.affiliate_process_order() from public;
revoke all on function public.affiliate_partner_status_notification() from public;
revoke all on function public.affiliate_sync_commission_status() from public;
revoke all on function public.affiliate_withdrawal_status_audit() from public;

do $$ declare t text; begin
  foreach t in array array['affiliate_settings','affiliate_partners','affiliate_referrals','affiliate_commissions','affiliate_withdrawals','affiliate_ledger','affiliate_marketing_assets','store_policies','affiliate_audit_log'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
  end loop;
end $$;

grant select on public.affiliate_settings,public.store_policies to anon,authenticated;
grant select on public.affiliate_partners,public.affiliate_commissions,public.affiliate_withdrawals,public.affiliate_ledger,public.affiliate_marketing_assets to authenticated;
grant select,insert,update,delete on public.affiliate_settings,public.affiliate_partners,public.affiliate_referrals,public.affiliate_commissions,public.affiliate_withdrawals,public.affiliate_ledger,public.affiliate_marketing_assets,public.store_policies,public.affiliate_audit_log to authenticated;

drop policy if exists "affiliate settings public read" on public.affiliate_settings;
drop policy if exists "published policies public read" on public.store_policies;
drop policy if exists "partner reads own profile" on public.affiliate_partners;
drop policy if exists "partner reads own commissions" on public.affiliate_commissions;
drop policy if exists "partner reads own withdrawals" on public.affiliate_withdrawals;
drop policy if exists "partner reads own ledger" on public.affiliate_ledger;
drop policy if exists "active partners read marketing assets" on public.affiliate_marketing_assets;
drop policy if exists "affiliate admin settings" on public.affiliate_settings;
drop policy if exists "affiliate admin partners" on public.affiliate_partners;
drop policy if exists "affiliate admin referrals" on public.affiliate_referrals;
drop policy if exists "affiliate admin commissions" on public.affiliate_commissions;
drop policy if exists "affiliate admin withdrawals" on public.affiliate_withdrawals;
drop policy if exists "affiliate admin ledger" on public.affiliate_ledger;
drop policy if exists "affiliate admin assets" on public.affiliate_marketing_assets;
drop policy if exists "affiliate admin policies" on public.store_policies;
drop policy if exists "affiliate admin audit read" on public.affiliate_audit_log;

create policy "affiliate settings public read" on public.affiliate_settings for select to anon,authenticated using (true);
create policy "published policies public read" on public.store_policies for select to anon,authenticated using (published=true);
create policy "partner reads own profile" on public.affiliate_partners for select to authenticated using (user_id=(select auth.uid()) or public.affiliate_is_admin());
create policy "partner reads own commissions" on public.affiliate_commissions for select to authenticated using (partner_id in (select id from public.affiliate_partners where user_id=(select auth.uid())) or public.affiliate_is_admin());
create policy "partner reads own withdrawals" on public.affiliate_withdrawals for select to authenticated using (partner_id in (select id from public.affiliate_partners where user_id=(select auth.uid())) or public.affiliate_is_admin());
create policy "partner reads own ledger" on public.affiliate_ledger for select to authenticated using (partner_id in (select id from public.affiliate_partners where user_id=(select auth.uid())) or public.affiliate_is_admin());
create policy "active partners read marketing assets" on public.affiliate_marketing_assets for select to authenticated using ((active=true and exists(select 1 from public.affiliate_partners where user_id=(select auth.uid()) and status='active')) or public.affiliate_is_admin());

create policy "affiliate admin settings" on public.affiliate_settings for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin partners" on public.affiliate_partners for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin referrals" on public.affiliate_referrals for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin commissions" on public.affiliate_commissions for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin withdrawals" on public.affiliate_withdrawals for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin ledger" on public.affiliate_ledger for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin assets" on public.affiliate_marketing_assets for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin policies" on public.store_policies for all to authenticated using (public.affiliate_is_admin()) with check (public.affiliate_is_admin());
create policy "affiliate admin audit read" on public.affiliate_audit_log for select to authenticated using (public.affiliate_is_admin());

-- Data API exposure is now opt-in on newer Supabase projects.
grant usage on schema public to anon,authenticated;
grant usage,select on all sequences in schema public to authenticated;
