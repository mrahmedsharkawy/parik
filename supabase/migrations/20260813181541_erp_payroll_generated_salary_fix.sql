do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'erp_payroll_items'
      and column_name = 'allowance'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'erp_payroll_items'
      and column_name = 'allowances'
  ) then
    alter table public.erp_payroll_items rename column allowance to allowances;
  end if;
end $$;

alter table public.erp_payroll_items
  add column if not exists allowances numeric(14,2) not null default 0,
  add column if not exists overtime numeric(14,2) not null default 0,
  add column if not exists advance numeric(14,2) not null default 0;

drop view if exists public.erp_payroll_summary;

create view public.erp_payroll_summary
with (security_invoker = true)
as
select
  p.id,
  p.payroll_month,
  p.status,
  p.notes,
  p.created_at,
  count(pi.id) as employee_count,
  coalesce(sum(pi.basic_salary), 0) as basic_total,
  coalesce(sum(pi.allowances), 0) as allowances_total,
  coalesce(sum(pi.overtime), 0) as overtime_total,
  coalesce(sum(pi.deductions), 0) as deductions_total,
  coalesce(sum(pi.advance), 0) as advance_total,
  coalesce(sum(pi.net_salary), 0) as total
from public.erp_payroll p
left join public.erp_payroll_items pi on pi.payroll_id = p.id
group by p.id;

grant select on public.erp_payroll_summary to authenticated;
