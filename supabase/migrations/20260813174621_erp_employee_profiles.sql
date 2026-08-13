alter table public.erp_employees
  add column if not exists photo_url text,
  add column if not exists residence_attachment_url text,
  add column if not exists residence_renewal_notes text,
  add column if not exists annual_leave_days numeric(8,2) not null default 0,
  add column if not exists used_leave_days numeric(8,2) not null default 0,
  add column if not exists overtime_hours numeric(10,2) not null default 0,
  add column if not exists overtime_rate numeric(14,2) not null default 0,
  add column if not exists late_minutes integer not null default 0,
  add column if not exists late_penalty numeric(14,2) not null default 0,
  add column if not exists performance_percent integer not null default 0 check (performance_percent >= 0 and performance_percent <= 100),
  add column if not exists rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  add column if not exists strengths text,
  add column if not exists mistakes text,
  add column if not exists evaluation_notes text;

alter table public.erp_payroll_items
  add column if not exists allowances numeric(14,2) not null default 0;

create table if not exists public.erp_employee_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.erp_employees(id) on delete cascade,
  note_type text not null default 'note' check (note_type in ('note','strength','mistake','warning','reward','leave','late','overtime')),
  title text not null,
  body text,
  value numeric(14,2),
  event_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists erp_employee_notes_employee_idx
  on public.erp_employee_notes(employee_id, event_date desc);

alter table public.erp_employee_notes enable row level security;

grant select, insert, update, delete on public.erp_employee_notes to authenticated;

drop policy if exists "erp_employee_notes authenticated manage" on public.erp_employee_notes;
create policy "erp_employee_notes authenticated manage"
  on public.erp_employee_notes
  for all
  to authenticated
  using (true)
  with check (true);
