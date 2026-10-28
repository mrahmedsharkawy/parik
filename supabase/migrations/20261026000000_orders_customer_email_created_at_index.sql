-- Customer account order history filters by email and sorts newest first.
-- This composite index avoids scanning and sorting the complete orders table.
create index if not exists idx_orders_customer_email_created_at_desc
  on public.orders (customer_email, created_at desc);
