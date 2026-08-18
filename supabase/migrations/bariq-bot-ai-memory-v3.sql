-- Bariq AI Sales Assistant Memory V3
-- Safe additive migration: does not delete existing bot data.

alter table public.bot_conversations add column if not exists quantity numeric;
alter table public.bot_conversations add column if not exists company boolean not null default false;
alter table public.bot_conversations add column if not exists city text;
alter table public.bot_conversations add column if not exists category text;
alter table public.bot_conversations add column if not exists last_action text;
alter table public.bot_conversations add column if not exists customer_id uuid;
alter table public.bot_conversations add column if not exists phone text;

alter table public.bot_messages add column if not exists external_message_id text;
create unique index if not exists bot_messages_external_message_id_uidx
on public.bot_messages(external_message_id)
where external_message_id is not null;

create table if not exists public.customer_memories (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  customer_id uuid null,
  memory_type text not null,
  memory_key text not null,
  memory_text text not null,
  memory_value jsonb not null default '{}'::jsonb,
  importance smallint not null default 5 check (importance between 1 and 10),
  confidence numeric(4,3) not null default 0.8 check (confidence >= 0 and confidence <= 1),
  source_message_id uuid null references public.bot_messages(id) on delete set null,
  source_conversation_id uuid null references public.bot_conversations(id) on delete set null,
  memory_scope text not null default 'long_term' check (memory_scope in ('session','temporary','long_term')),
  last_used_at timestamptz null,
  expires_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_key, memory_type, memory_key)
);

create table if not exists public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.bot_conversations(id) on delete cascade,
  owner_key text not null,
  customer_id uuid null,
  summary_text text not null default '',
  structured_summary jsonb not null default '{}'::jsonb,
  messages_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_memories_owner_active_idx
on public.customer_memories(owner_key, is_active, importance desc, updated_at desc);

create index if not exists customer_memories_customer_type_idx
on public.customer_memories(customer_id, memory_type)
where customer_id is not null;

create index if not exists conversation_summaries_owner_updated_idx
on public.conversation_summaries(owner_key, updated_at desc);

create index if not exists bot_conversations_customer_updated_idx
on public.bot_conversations(customer_id, updated_at desc)
where customer_id is not null;

alter table public.customer_memories enable row level security;
alter table public.conversation_summaries enable row level security;

grant select, insert, update, delete on public.customer_memories to authenticated;
grant select, insert, update, delete on public.conversation_summaries to authenticated;

drop policy if exists "Admins can manage customer memories" on public.customer_memories;
create policy "Admins can manage customer memories"
on public.customer_memories
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Admins can manage conversation summaries" on public.conversation_summaries;
create policy "Admins can manage conversation summaries"
on public.conversation_summaries
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);


-- =========================================================
-- V4 ADD-ON: Knowledge typo matching indexes / state safety
-- =========================================================
create extension if not exists pg_trgm with schema extensions;
create index if not exists bot_knowledge_question_trgm_idx
on public.bot_knowledge using gin (public.bariq_normalize_ar(question) extensions.gin_trgm_ops);

-- Helpful indexes for stateful conversation continuation.
create index if not exists bot_conversations_updated_at_idx
on public.bot_conversations(updated_at desc);
create index if not exists bot_messages_role_created_idx
on public.bot_messages(conversation_id, role, created_at desc);
