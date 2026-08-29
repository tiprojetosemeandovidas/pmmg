-- Mentor IA: histórico privado, fontes, custos e auditoria operacional.
create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text,
  question text not null check (char_length(question) between 3 and 1200),
  answer jsonb,
  sources jsonb not null default '[]'::jsonb,
  model text,
  prompt_version text not null default 'mentor-v1',
  mode text not null default 'ai' check (mode in ('ai','deterministic')),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  latency_ms integer check (latency_ms >= 0),
  status text not null default 'started' check (status in ('started','completed','refused','failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists ai_interactions_user_date_idx
  on public.ai_interactions(user_id, created_at desc);
create index if not exists ai_interactions_daily_limit_idx
  on public.ai_interactions(user_id, created_at)
  where status in ('completed','refused');

alter table public.ai_interactions enable row level security;

drop policy if exists "ai_interactions_select_own" on public.ai_interactions;
create policy "ai_interactions_select_own"
on public.ai_interactions for select
using (auth.uid() = user_id);

-- Escritas são feitas apenas pela API server-side com service_role.
