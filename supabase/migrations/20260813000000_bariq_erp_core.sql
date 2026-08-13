-- Bariq ERP standalone schema.
-- This module is intentionally independent from storefront orders/products/customers.

create table if not exists public.erp_expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null default 'expense' check (type in ('income','expense')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  category text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.erp_expense_categories(id) on delete set null,
  category text,
  description text not null,
  payment_method text,
  supplier_id uuid references public.erp_suppliers(id) on delete set null,
  external_reference text,
  invoice_number text,
  attachment_url text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  unit text not null default 'piece',
  opening_quantity numeric(14,3) not null default 0,
  opening_cost numeric(14,2) not null default 0,
  minimum_stock numeric(14,3) not null default 0,
  supplier_id uuid references public.erp_suppliers(id) on delete set null,
  location text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.erp_materials(id) on delete cascade,
  movement_date date not null default current_date,
  movement_type text not null check (movement_type in ('purchase','consumption','waste','addition','adjustment','transfer')),
  quantity numeric(14,3) not null check (quantity >= 0),
  unit_cost numeric(14,2),
  reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.erp_suppliers(id) on delete set null,
  purchase_date date not null default current_date,
  invoice_number text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.erp_purchases(id) on delete cascade,
  material_id uuid references public.erp_materials(id) on delete set null,
  description text,
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  total numeric(14,2) generated always as (quantity * unit_cost) stored
);

create table if not exists public.erp_employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  job_title text,
  department text,
  salary numeric(14,2) not null default 0,
  hire_date date,
  phone text,
  emirates_id text,
  residence_expiry date,
  passport_number text,
  contract_url text,
  allowances numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_payroll (
  id uuid primary key default gen_random_uuid(),
  payroll_month date not null,
  status text not null default 'draft' check (status in ('draft','approved','paid','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.erp_payroll(id) on delete cascade,
  employee_id uuid not null references public.erp_employees(id) on delete cascade,
  basic_salary numeric(14,2) not null default 0,
  allowances numeric(14,2) not null default 0,
  overtime numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0,
  advance numeric(14,2) not null default 0,
  net_salary numeric(14,2) generated always as (basic_salary + allowances + overtime - deductions - advance) stored,
  notes text
);

create table if not exists public.erp_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_number text,
  owner_type text,
  owner_name text,
  employee_id uuid references public.erp_employees(id) on delete set null,
  issue_date date,
  expiry_date date,
  attachment_url text,
  alert_days integer not null default 30,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  source_table text,
  source_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists erp_transactions_date_idx on public.erp_transactions(transaction_date desc);
create index if not exists erp_transactions_type_idx on public.erp_transactions(type);
create index if not exists erp_stock_movements_material_idx on public.erp_stock_movements(material_id, movement_date desc);
create index if not exists erp_purchases_supplier_idx on public.erp_purchases(supplier_id, purchase_date desc);
create index if not exists erp_documents_expiry_idx on public.erp_documents(expiry_date) where active = true;

insert into public.erp_expense_categories (name, type, sort_order)
values
  ('مبيعات', 'income', 1),
  ('خدمات', 'income', 2),
  ('إيجار', 'expense', 10),
  ('رواتب', 'expense', 20),
  ('بنزين', 'expense', 30),
  ('إعلانات', 'expense', 40),
  ('كهرباء', 'expense', 50),
  ('مواد خام', 'expense', 60),
  ('شحن', 'expense', 70),
  ('صيانة', 'expense', 80),
  ('مشتريات', 'expense', 90),
  ('معدات', 'expense', 100),
  ('رسوم إقامة', 'expense', 110),
  ('تجديد', 'expense', 120),
  ('مصروفات أخرى', 'expense', 130)
on conflict (name) do nothing;

create or replace view public.erp_material_stock_summary
with (security_invoker = true)
as
select
  m.id,
  m.name,
  m.code,
  m.unit,
  m.opening_quantity,
  m.opening_cost,
  m.minimum_stock,
  m.location,
  coalesce(sum(
    case sm.movement_type
      when 'purchase' then sm.quantity
      when 'addition' then sm.quantity
      when 'adjustment' then sm.quantity
      when 'consumption' then -sm.quantity
      when 'waste' then -sm.quantity
      when 'transfer' then -sm.quantity
      else 0
    end
  ), 0) + m.opening_quantity as current_stock,
  case
    when coalesce(sum(case when sm.unit_cost is not null then sm.quantity else 0 end), 0) > 0
      then coalesce(sum(coalesce(sm.unit_cost, 0) * sm.quantity) / nullif(sum(case when sm.unit_cost is not null then sm.quantity else 0 end), 0), m.opening_cost)
    else m.opening_cost
  end as average_cost,
  m.active,
  m.created_at
from public.erp_materials m
left join public.erp_stock_movements sm on sm.material_id = m.id
group by m.id;

create or replace view public.erp_dashboard_summary
with (security_invoker = true)
as
select
  coalesce(sum(case when type = 'income' then amount else 0 end), 0) as total_income,
  coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as total_expenses,
  coalesce(sum(case when type = 'income' then amount else -amount end), 0) as net_profit,
  count(*) filter (where type = 'income') as income_count,
  count(*) filter (where type = 'expense') as expense_count
from public.erp_transactions;

create or replace view public.erp_payroll_summary
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
  coalesce(sum(pi.deductions), 0) as deductions_total,
  coalesce(sum(pi.net_salary), 0) as total
from public.erp_payroll p
left join public.erp_payroll_items pi on pi.payroll_id = p.id
group by p.id;

alter table public.erp_expense_categories enable row level security;
alter table public.erp_suppliers enable row level security;
alter table public.erp_transactions enable row level security;
alter table public.erp_materials enable row level security;
alter table public.erp_stock_movements enable row level security;
alter table public.erp_purchases enable row level security;
alter table public.erp_purchase_items enable row level security;
alter table public.erp_employees enable row level security;
alter table public.erp_payroll enable row level security;
alter table public.erp_payroll_items enable row level security;
alter table public.erp_documents enable row level security;
alter table public.erp_alerts enable row level security;

grant select, insert, update, delete on
  public.erp_expense_categories,
  public.erp_suppliers,
  public.erp_transactions,
  public.erp_materials,
  public.erp_stock_movements,
  public.erp_purchases,
  public.erp_purchase_items,
  public.erp_employees,
  public.erp_payroll,
  public.erp_payroll_items,
  public.erp_documents,
  public.erp_alerts
to authenticated;

grant select on public.erp_material_stock_summary, public.erp_dashboard_summary, public.erp_payroll_summary to authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'erp_expense_categories',
    'erp_suppliers',
    'erp_transactions',
    'erp_materials',
    'erp_stock_movements',
    'erp_purchases',
    'erp_purchase_items',
    'erp_employees',
    'erp_payroll',
    'erp_payroll_items',
    'erp_documents',
    'erp_alerts'
  ]
  loop
    execute format('drop policy if exists "%s authenticated manage" on public.%I', tbl, tbl);
    execute format('create policy "%s authenticated manage" on public.%I for all to authenticated using (true) with check (true)', tbl, tbl);
  end loop;
end $$;
