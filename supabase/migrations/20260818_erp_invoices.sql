-- Bariq ERP Invoices module
-- Independent from treasury and other ERP modules.
-- Stores invoice snapshots; does NOT modify source orders.

create table if not exists public.erp_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid,
  order_number text,
  invoice_type text not null default 'normal' check (invoice_type in ('normal','tax')),
  invoice_date date not null default current_date,
  invoice_time time not null default current_time,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  discount_fixed numeric(14,2) not null default 0 check (discount_fixed >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  vat_rate numeric(5,2) not null default 5 check (vat_rate >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  shipping numeric(14,2) not null default 0 check (shipping >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  deposit numeric(14,2) not null default 0 check (deposit >= 0),
  paid numeric(14,2) not null default 0 check (paid >= 0),
  remaining numeric(14,2) not null default 0 check (remaining >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  payment_method text default 'cash' check (payment_method in ('cash','bank_transfer','card','cheque','payment_link','other')),
  amount_in_words text,
  notes text,
  terms text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled boolean not null default false,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text
);

-- Sequence-like helper for invoice numbers (safe because unique constraint + retry on conflict)
create index if not exists erp_invoices_number_idx on public.erp_invoices(invoice_number);
create index if not exists erp_invoices_order_idx on public.erp_invoices(order_id, cancelled);
create index if not exists erp_invoices_date_idx on public.erp_invoices(invoice_date desc);
create index if not exists erp_invoices_created_idx on public.erp_invoices(created_at desc);

-- RLS
alter table public.erp_invoices enable row level security;
grant select, insert, update, delete on public.erp_invoices to authenticated;

drop policy if exists "erp_invoices authenticated manage" on public.erp_invoices;
create policy "erp_invoices authenticated manage" on public.erp_invoices
  for all to authenticated using (true) with check (true);
