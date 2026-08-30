-- Operação da coorte fechada: convites, consentimento e feedback dos 10 participantes.
create table if not exists public.pilot_cohorts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  target_size integer not null default 10 check (target_size between 1 and 100),
  status text not null default 'draft' check (status in ('draft','recruiting','active','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.pilot_participants (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.pilot_cohorts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invite_email text not null check (invite_email = lower(trim(invite_email))),
  status text not null default 'invited' check (status in ('invited','active','completed','withdrawn')),
  consented_at timestamptz,
  joined_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, invite_email),
  unique (cohort_id, user_id),
  check ((status in ('active','completed') and user_id is not null and consented_at is not null and joined_at is not null) or status in ('invited','withdrawn')),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.pilot_cohorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('onboarding','week_one','final')),
  ease_score smallint not null check (ease_score between 1 and 5),
  value_score smallint not null check (value_score between 1 and 5),
  recommendation_score smallint not null check (recommendation_score between 0 and 10),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (cohort_id, user_id, stage)
);

create index if not exists pilot_participants_cohort_status_idx on public.pilot_participants(cohort_id, status);
create index if not exists pilot_feedback_cohort_stage_idx on public.pilot_feedback(cohort_id, stage);

alter table public.pilot_cohorts enable row level security;
alter table public.pilot_participants enable row level security;
alter table public.pilot_feedback enable row level security;

-- Sem políticas públicas: cadastro e relatórios passam pela API server-side.
alter table public.pilot_events drop constraint if exists pilot_events_event_type_check;
alter table public.pilot_events add constraint pilot_events_event_type_check check (event_type in (
  'onboarding_completed','diagnostic_started','diagnostic_completed','question_answered',
  'task_completed','weekly_checkin_completed','review_completed','notification_opened',
  'pilot_joined','feedback_submitted'
));
