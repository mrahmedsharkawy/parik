-- Bariq ERP Treasury / Financial Center module.
-- Independent from storefront and other ERP modules; all values are manually entered.

create table if not exists public.erp_company_capital (
  id uuid primary key default gen_random_uuid(),
  capital_amount numeric(14,2) not null default 0 check (capital_amount >= 0),
  reserve_amount numeric(14,2) not null default 0 check (reserve_amount >= 0),
  effective_date date not null default current_date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_name text,
  account_number text,
  balance numeric(14,2) not null default 0,
  currency text not null default 'AED',
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_cash_register (
  id uuid primary key default gen_random_uuid(),
  balance numeric(14,2) not null default 0,
  currency text not null default 'AED',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  purchase_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash','bank_transfer','installment','financing')),
  down_payment numeric(14,2) not null default 0 check (down_payment >= 0),
  financed_amount numeric(14,2) not null default 0 check (financed_amount >= 0),
  current_value numeric(14,2) not null default 0 check (current_value >= 0),
  status text not null default 'active' check (status in ('active','sold','disposed','maintenance')),
  serial_number text,
  supplier_id uuid references public.erp_suppliers(id) on delete set null,
  depreciation_method text default 'none' check (depreciation_method in ('none','straight_line')),
  useful_life_years integer,
  salvage_value numeric(14,2) default 0,
  annual_depreciation numeric(14,2) default 0,
  book_value numeric(14,2) default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_asset_installments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.erp_fixed_assets(id) on delete cascade,
  installment_number integer not null default 1,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  due_date date not null,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  paid_at timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming','due_today','overdue','paid','partial')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_liabilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creditor text not null,
  reason text,
  original_amount numeric(14,2) not null default 0 check (original_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  remaining_amount numeric(14,2) generated always as (greatest(original_amount - paid_amount, 0)) stored,
  start_date date not null default current_date,
  due_date date,
  has_installments boolean not null default false,
  installment_amount numeric(14,2) default 0,
  installments_count integer default 0,
  status text not null default 'active' check (status in ('active','paid','overdue','defaulted')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_receivables (
  id uuid primary key default gen_random_uuid(),
  party_name text not null,
  party_type text default 'customer' check (party_type in ('customer','other')),
  original_amount numeric(14,2) not null default 0 check (original_amount >= 0),
  collected_amount numeric(14,2) not null default 0 check (collected_amount >= 0),
  remaining_amount numeric(14,2) generated always as (greatest(original_amount - collected_amount, 0)) stored,
  due_date date,
  status text not null default 'active' check (status in ('active','collected','overdue','partial')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_inventory_value (
  id uuid primary key default gen_random_uuid(),
  value numeric(14,2) not null default 0 check (value >= 0),
  effective_date date not null default current_date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  type text not null check (type in (
    'deposit','withdrawal','expense','capital_injection','owner_withdrawal',
    'internal_transfer','asset_purchase','asset_sale','installment_payment',
    'receivable_collection','liability_payment','balance_adjustment','other'
  )),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  source_type text check (source_type in ('bank','cash','capital','asset','liability','receivable')),
  source_id uuid,
  destination_type text check (destination_type in ('bank','cash','capital','asset','liability','receivable')),
  destination_id uuid,
  description text not null,
  reference_number text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled boolean not null default false,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by uuid
);

create table if not exists public.erp_audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert','update','delete','cancel')),
  old_values jsonb,
  new_values jsonb,
  reason text,
  performed_by uuid default auth.uid(),
  performed_at timestamptz not null default now()
);

-- Indexes

create index if not exists erp_company_capital_date_idx on public.erp_company_capital(effective_date desc);
create index if not exists erp_bank_accounts_active_idx on public.erp_bank_accounts(active);
create index if not exists erp_fixed_assets_status_idx on public.erp_fixed_assets(status);
create index if not exists erp_asset_installments_asset_idx on public.erp_asset_installments(asset_id, due_date);
create index if not exists erp_asset_installments_due_idx on public.erp_asset_installments(due_date);
create index if not exists erp_asset_installments_status_idx on public.erp_asset_installments(status);
create index if not exists erp_liabilities_due_idx on public.erp_liabilities(due_date);
create index if not exists erp_liabilities_status_idx on public.erp_liabilities(status);
create index if not exists erp_receivables_due_idx on public.erp_receivables(due_date);
create index if not exists erp_receivables_status_idx on public.erp_receivables(status);
create index if not exists erp_inventory_value_date_idx on public.erp_inventory_value(effective_date desc);
create index if not exists erp_treasury_transactions_date_idx on public.erp_treasury_transactions(transaction_date desc);
create index if not exists erp_treasury_transactions_type_idx on public.erp_treasury_transactions(type);
create index if not exists erp_treasury_transactions_cancelled_idx on public.erp_treasury_transactions(cancelled);
create index if not exists erp_audit_log_table_idx on public.erp_audit_log(table_name, record_id);
create index if not exists erp_audit_log_performed_idx on public.erp_audit_log(performed_at desc);

-- RLS

alter table public.erp_company_capital enable row level security;
alter table public.erp_bank_accounts enable row level security;
alter table public.erp_cash_register enable row level security;
alter table public.erp_fixed_assets enable row level security;
alter table public.erp_asset_installments enable row level security;
alter table public.erp_liabilities enable row level security;
alter table public.erp_receivables enable row level security;
alter table public.erp_inventory_value enable row level security;
alter table public.erp_treasury_transactions enable row level security;
alter table public.erp_audit_log enable row level security;

grant select, insert, update, delete on
  public.erp_company_capital,
  public.erp_bank_accounts,
  public.erp_cash_register,
  public.erp_fixed_assets,
  public.erp_asset_installments,
  public.erp_liabilities,
  public.erp_receivables,
  public.erp_inventory_value,
  public.erp_treasury_transactions
 to authenticated;

grant select, insert on public.erp_audit_log to authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'erp_company_capital',
    'erp_bank_accounts',
    'erp_cash_register',
    'erp_fixed_assets',
    'erp_asset_installments',
    'erp_liabilities',
    'erp_receivables',
    'erp_inventory_value',
    'erp_treasury_transactions',
    'erp_audit_log'
  ]
  loop
    execute format('drop policy if exists "%s authenticated manage" on public.%I', tbl, tbl);
    execute format('create policy "%s authenticated manage" on public.%I for all to authenticated using (true) with check (true)', tbl, tbl);
  end loop;
end $$;
