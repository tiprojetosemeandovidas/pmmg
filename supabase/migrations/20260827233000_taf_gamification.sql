-- TAF genérico e gamificação saudável baseada em evidências.
create table if not exists public.physical_events (
  code text primary key,
  name text not null,
  unit text not null check (unit in ('m','repeticoes','segundos')),
  direction text not null check (direction in ('higher','lower')),
  description text not null,
  active boolean not null default true
);

create table if not exists public.physical_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_code text not null references public.physical_events(code) on delete cascade,
  target_value numeric(10,2) not null check (target_value > 0),
  goal_source text not null default 'personal' check (goal_source in ('personal','validated_notice')),
  source_notice_id uuid references public.notices(id) on delete set null,
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_code),
  check ((goal_source = 'validated_notice' and source_notice_id is not null and is_official) or (goal_source = 'personal' and not is_official))
);

create table if not exists public.physical_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_code text not null references public.physical_events(code) on delete restrict,
  value numeric(10,2) not null check (value > 0),
  measured_at date not null,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

create table if not exists public.achievement_definitions (
  code text primary key,
  title text not null,
  description text not null,
  icon text not null,
  xp_reward integer not null default 0 check (xp_reward between 0 and 100),
  active boolean not null default true
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_code text not null references public.achievement_definitions(code) on delete cascade,
  evidence jsonb not null default '{}'::jsonb,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create index if not exists physical_results_user_date_idx on public.physical_results(user_id, measured_at desc);
create index if not exists user_achievements_user_date_idx on public.user_achievements(user_id, earned_at desc);

alter table public.physical_events enable row level security;
alter table public.physical_goals enable row level security;
alter table public.physical_results enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "physical_events_read" on public.physical_events;
create policy "physical_events_read" on public.physical_events for select using (active);
drop policy if exists "achievement_definitions_read" on public.achievement_definitions;
create policy "achievement_definitions_read" on public.achievement_definitions for select using (active);
drop policy if exists "physical_goals_select_own" on public.physical_goals;
create policy "physical_goals_select_own" on public.physical_goals for select using (auth.uid() = user_id);
drop policy if exists "physical_results_select_own" on public.physical_results;
create policy "physical_results_select_own" on public.physical_results for select using (auth.uid() = user_id);
drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own" on public.user_achievements for select using (auth.uid() = user_id);

-- Metas, medições e conquistas são gravadas pela API server-side. Metas
-- pessoais nunca recebem o selo de requisito oficial.
insert into public.physical_events (code, name, unit, direction, description) values
  ('run_12m','Corrida de 12 minutos','m','higher','Distância total percorrida em doze minutos.'),
  ('pull_ups','Barra fixa','repeticoes','higher','Repetições completas conforme o protocolo usado no treino.'),
  ('push_ups','Flexão de braços','repeticoes','higher','Repetições completas, sem presumir regra de edital.'),
  ('sit_ups','Abdominal','repeticoes','higher','Repetições no tempo e protocolo definidos pelo acompanhamento.'),
  ('shuttle_run','Shuttle run','segundos','lower','Tempo total; neste evento, menor resultado representa evolução.')
on conflict (code) do update set name = excluded.name, unit = excluded.unit, direction = excluded.direction, description = excluded.description, active = true;

insert into public.achievement_definitions (code, title, description, icon, xp_reward) values
  ('route_created','Rota criada','Concluiu o onboarding adaptativo.','◇',20),
  ('first_session','Primeiro passo','Concluiu a primeira sessão planejada.','✓',20),
  ('diagnostic_complete','Ponto de partida','Concluiu o diagnóstico inicial.','◎',40),
  ('streak_3','Ritmo sustentável','Estudou em três dias consecutivos.','↗',30),
  ('weekly_review','Ciclo fechado','Concluiu o primeiro fechamento semanal.','↻',40),
  ('study_300','Base construída','Acumulou 300 minutos de sessões concluídas.','▤',40),
  ('taf_started','Preparação integral','Registrou a primeira medição física.','⚑',20)
on conflict (code) do update set title = excluded.title, description = excluded.description, icon = excluded.icon, xp_reward = excluded.xp_reward, active = true;
