create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  customer_id uuid null,
  phone text null,
  current_topic text null,
  pending_action text null,
  waiting_for text null,
  order_id text null,
  recipient text null,
  occasion text null,
  budget numeric null,
  category_id text null,
  product_id text null,
  last_intent text null,
  last_knowledge_id bigint null,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bot_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  intent text null,
  knowledge_id bigint null,
  action text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_unanswered (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  normalized_text text not null unique,
  count integer not null default 1,
  conversation_id uuid null references public.bot_conversations(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.bot_knowledge add column if not exists action_value text;

create index if not exists bot_conversations_session_id_idx on public.bot_conversations(session_id);
create index if not exists bot_conversations_status_idx on public.bot_conversations(status);
create index if not exists bot_messages_conversation_id_created_at_idx on public.bot_messages(conversation_id, created_at desc);
create index if not exists bot_unanswered_last_seen_at_idx on public.bot_unanswered(last_seen_at desc);

alter table public.bot_conversations enable row level security;
alter table public.bot_messages enable row level security;
alter table public.bot_unanswered enable row level security;

grant select, insert, update, delete on public.bot_conversations to authenticated;
grant select, insert, update, delete on public.bot_messages to authenticated;
grant select, insert, update, delete on public.bot_unanswered to authenticated;

drop policy if exists "Admins can manage bot conversations" on public.bot_conversations;
create policy "Admins can manage bot conversations"
on public.bot_conversations
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = (select auth.uid()) or a.email = (select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = (select auth.uid()) or a.email = (select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Admins can manage bot messages" on public.bot_messages;
create policy "Admins can manage bot messages"
on public.bot_messages
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = (select auth.uid()) or a.email = (select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = (select auth.uid()) or a.email = (select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Admins can manage bot unanswered" on public.bot_unanswered;
create policy "Admins can manage bot unanswered"
on public.bot_unanswered
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = (select auth.uid()) or a.email = (select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = (select auth.uid()) or a.email = (select auth.jwt() ->> 'email'))
  )
);
