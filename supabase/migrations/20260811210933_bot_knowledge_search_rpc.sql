create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

alter table public.bot_knowledge add column if not exists input_type text default 'info';
alter table public.bot_knowledge add column if not exists param_type text;
alter table public.bot_knowledge add column if not exists param_example text;
alter table public.bot_knowledge add column if not exists action_name text;
alter table public.bot_knowledge add column if not exists action_value text;
alter table public.bot_knowledge add column if not exists usage_count integer not null default 0;
alter table public.bot_knowledge add column if not exists active boolean not null default true;
alter table public.bot_knowledge add column if not exists updated_at timestamptz not null default now();

create or replace function public.bariq_normalize_ar(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    translate(
      lower(extensions.unaccent(coalesce(value, ''))),
      'إأآٱؤئىةًٌٍَُِّْـ',
      'ااااوويها        '
    ),
    '[^[:alnum:]ء-ي#]+',
    ' ',
    'g'
  ));
$$;

create index if not exists bot_knowledge_action_active_idx
on public.bot_knowledge (action_name, active);

create index if not exists bot_knowledge_usage_active_idx
on public.bot_knowledge (active, usage_count desc);

create or replace function public.bot_knowledge_search(
  p_message text,
  p_context jsonb default '{}'::jsonb,
  p_limit integer default 80
)
returns table (
  id bigint,
  question text,
  answer text,
  category text,
  keywords jsonb,
  input_type text,
  param_type text,
  param_example text,
  action_name text,
  action_value text,
  active boolean,
  usage_count integer,
  score numeric,
  similarity numeric,
  matched_tokens text[]
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select
      public.bariq_normalize_ar(p_message) as msg,
      public.bariq_normalize_ar(coalesce(p_context->>'recipient', '')) as recipient,
      public.bariq_normalize_ar(coalesce(p_context->>'occasion', '')) as occasion,
      public.bariq_normalize_ar(coalesce(p_context->>'category', '')) as ctx_category,
      public.bariq_normalize_ar(coalesce(p_context->>'topic', '')) as topic,
      least(greatest(coalesce(p_limit, 80), 1), 160) as lim
  ),
  input_tokens as (
    select array_remove(array_agg(distinct tok), '') as tokens
    from input, unnest(regexp_split_to_array(input.msg, '\s+')) tok
    where length(tok) > 1
      and tok not in ('في','من','على','الي','الى','عن','هو','هي','هل','ايه','كم','بكم','عايز','اريد','ابي','ابغي','محتاج','عندكم')
  ),
  rows as (
    select
      k.*,
      public.bariq_normalize_ar(concat_ws(' ', k.question, k.answer, k.category, array_to_string(k.keywords, ' '), k.input_type, k.action_name, k.action_value)) as doc,
      public.bariq_normalize_ar(coalesce(k.question, '')) as q_norm
    from public.bot_knowledge k
    where k.active = true
  ),
  scored as (
    select
      r.*,
      (
        case when r.q_norm = input.msg then 45 else 0 end
        + case when input.msg <> '' and (r.q_norm like '%' || input.msg || '%' or input.msg like '%' || r.q_norm || '%') then 24 else 0 end
        + greatest(extensions.similarity(r.q_norm, input.msg) * 30, extensions.similarity(r.doc, input.msg) * 18)
        + coalesce((select count(*) * 5 from unnest((select tokens from input_tokens)) tok where r.doc like '%' || tok || '%'), 0)
        + case when input.topic = 'order' and upper(coalesce(r.action_name, '')) in ('TRACK_ORDER','GET_ORDER_STATUS','GET_ORDER_DETAILS') then 18 else 0 end
        + case when input.topic in ('browse','gift') and upper(coalesce(r.action_name, '')) in ('CATEGORY_PRODUCTS','SHOW_CATEGORY','PRODUCT_SEARCH','SEARCH_PRODUCT','CUSTOM_GIFT_ORDER') then 12 else 0 end
        + case when input.occasion <> '' and r.doc like '%' || input.occasion || '%' then 8 else 0 end
        + case when input.recipient <> '' and r.doc like '%' || input.recipient || '%' then 5 else 0 end
        + case when input.ctx_category <> '' and r.doc like '%' || input.ctx_category || '%' then 28 else 0 end
        + case when input.ctx_category <> '' and input.topic in ('browse','gift') and upper(coalesce(r.action_name, '')) in ('CATEGORY_PRODUCTS','SHOW_CATEGORY','PRODUCT_SEARCH','SEARCH_PRODUCT') and r.doc not like '%' || input.ctx_category || '%' then -22 else 0 end
        + case when input.topic = 'order' and upper(coalesce(r.action_name, '')) in ('PRODUCT_SEARCH','CATEGORY_PRODUCTS','CUSTOM_GIFT_ORDER') then -20 else 0 end
        + case when input.topic in ('browse','gift') and upper(coalesce(r.action_name, '')) in ('TRACK_ORDER','GET_ORDER_STATUS','GET_ORDER_DETAILS') then -25 else 0 end
      )::numeric as final_score,
      extensions.similarity(r.q_norm, input.msg)::numeric as sim,
      coalesce(array(select tok from unnest((select tokens from input_tokens)) tok where r.doc like '%' || tok || '%' limit 20), array[]::text[]) as hits
    from rows r cross join input
  )
  select
    s.id,
    s.question,
    s.answer,
    s.category,
    to_jsonb(s.keywords) as keywords,
    s.input_type,
    s.param_type,
    s.param_example,
    s.action_name,
    s.action_value,
    s.active,
    s.usage_count,
    round(s.final_score, 2) as score,
    round(s.sim, 4) as similarity,
    s.hits as matched_tokens
  from scored s, input
  where s.final_score > 0
  order by s.final_score desc, s.usage_count desc, s.id desc
  limit (select lim from input);
$$;

grant execute on function public.bot_knowledge_search(text, jsonb, integer) to authenticated;
grant execute on function public.bot_knowledge_search(text, jsonb, integer) to service_role;
