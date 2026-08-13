create table if not exists public.erp_manual_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  customer_address text,
  status text not null default 'new',
  total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists erp_manual_orders_order_number_idx
  on public.erp_manual_orders(order_number);

create index if not exists erp_manual_orders_created_idx
  on public.erp_manual_orders(created_at desc);

alter table public.erp_manual_orders enable row level security;

grant select, insert, update, delete on public.erp_manual_orders to authenticated;

drop policy if exists "erp_manual_orders authenticated manage" on public.erp_manual_orders;
create policy "erp_manual_orders authenticated manage"
  on public.erp_manual_orders
  for all
  to authenticated
  using (true)
  with check (true);
