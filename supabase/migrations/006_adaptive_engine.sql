-- Rota V2 / Fase 5: Adaptive Engine explicável.
-- Persiste a recomendação atual e todos os fatores que justificam sua ordem.

create table if not exists public.adaptive_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  rank smallint not null check (rank between 1 and 100),
  action text not null check (action in ('learn', 'practice', 'review')),
  priority_score numeric(5,2) not null check (priority_score between 0 and 100),
  reason_code text not null,
  reason text not null,
  factors jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  model_version text not null default 'adaptive-v1',
  status text not null default 'active' check (status in ('active', 'completed', 'dismissed')),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id, model_version)
);

create index if not exists adaptive_recommendations_user_rank_idx
  on public.adaptive_recommendations(user_id, status, rank);

alter table public.adaptive_recommendations enable row level security;
drop policy if exists "adaptive_recommendations_select_own" on public.adaptive_recommendations;
create policy "adaptive_recommendations_select_own" on public.adaptive_recommendations
  for select using (auth.uid() = user_id);

comment on table public.adaptive_recommendations is
  'Prioridades determinísticas do Adaptive Engine, com fatores e evidências auditáveis.';
