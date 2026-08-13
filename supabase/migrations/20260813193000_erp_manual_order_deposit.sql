alter table public.erp_manual_orders
  add column if not exists deposit numeric(14,2) not null default 0,
  add column if not exists remaining numeric(14,2)
    generated always as (greatest(total - deposit, 0)) stored;

create index if not exists erp_manual_orders_remaining_idx
  on public.erp_manual_orders(remaining);
