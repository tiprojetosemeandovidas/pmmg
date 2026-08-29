-- Execute no SQL Editor do Supabase. Todas as tabelas são isoladas por usuário.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  exam_cycle text not null default 'pre_notice',
  weekly_goal_minutes integer not null default 420 check (weekly_goal_minutes > 0),
  pilot_status text not null default 'invited' check (pilot_status in ('invited', 'active', 'suspended', 'finished')),
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  planned_minutes integer not null check (planned_minutes > 0),
  completed_minutes integer check (completed_minutes >= 0),
  correct_answers integer check (correct_answers >= 0),
  total_questions integer check (total_questions >= 0),
  status text not null default 'planned' check (status in ('planned', 'started', 'completed', 'missed')),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  recommendation_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.priority_map (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  score numeric(5,2) not null check (score between 0 and 100),
  level text not null check (level in ('high', 'medium', 'maintenance')),
  evidence jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (user_id, subject)
);

create table if not exists public.question_axes (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  slug text not null unique, display_order integer not null default 0
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(), institution text not null,
  state char(2) not null, role text not null,
  exam_year integer not null check (exam_year between 1900 and 2100), organizer text,
  source_url text not null, authorization_reference text not null,
  status text not null default 'review' check (status in ('review','published','unpublished')),
  unique (institution,state,role,exam_year,organizer)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  axis_id uuid not null references public.question_axes(id) on delete restrict,
  subject text not null, topic text, statement text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_option integer, explanation text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  source_page integer, content_hash text not null unique,
  status text not null default 'review' check (status in ('review','published','rejected','unpublished')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.priority_map enable row level security;
alter table public.question_axes enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "sessions_select_own" on public.study_sessions;
create policy "sessions_select_own" on public.study_sessions for select using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.study_sessions;
create policy "sessions_insert_own" on public.study_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.study_sessions;
create policy "sessions_update_own" on public.study_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "priorities_select_own" on public.priority_map;
create policy "priorities_select_own" on public.priority_map for select using (auth.uid() = user_id);
drop policy if exists "axes_read_authenticated" on public.question_axes;
create policy "axes_read_authenticated" on public.question_axes for select to authenticated using (true);
drop policy if exists "published_exams_read_authenticated" on public.exams;
create policy "published_exams_read_authenticated" on public.exams for select to authenticated using (status = 'published');
drop policy if exists "published_questions_read_authenticated" on public.questions;
create policy "published_questions_read_authenticated" on public.questions for select to authenticated using (status = 'published');

insert into public.question_axes (name,slug,display_order) values
  ('Linguagens','linguagens',10), ('Raciocínio Lógico','raciocinio-logico',20),
  ('Direito','direito',30), ('Legislação Policial','legislacao-policial',40),
  ('Conhecimentos Gerais','conhecimentos-gerais',50)
on conflict (slug) do update set name=excluded.name, display_order=excluded.display_order;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ROTA V2: fundação multi-concurso e ciclo adaptativo.
-- As alterações abaixo preservam as tabelas do piloto PMMG.

alter table public.profiles add column if not exists education_level text;
alter table public.profiles alter column exam_cycle set default 'pre_notice';
alter table public.profiles add column if not exists study_stage text;
alter table public.profiles add column if not exists weekly_hours numeric(4,1);
alter table public.profiles add column if not exists available_days smallint[] not null default '{}'::smallint[];
alter table public.profiles add column if not exists preferred_period text;
alter table public.profiles add column if not exists interests text[] not null default '{}'::text[];
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists xp integer not null default 0 check (xp >= 0);
alter table public.profiles add column if not exists current_streak integer not null default 0 check (current_streak >= 0);
alter table public.profiles add column if not exists account_role text not null default 'candidate'
  check (account_role in ('candidate', 'reviewer', 'admin'));

create table if not exists public.exam_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  country_code char(2) not null default 'BR',
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  stable_code text not null unique,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  parent_topic_id uuid references public.topics(id) on delete set null,
  stable_code text not null unique,
  name text not null,
  slug text not null,
  depth smallint not null default 0 check (depth >= 0),
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);

alter table public.exams add column if not exists slug text;
alter table public.exams add column if not exists title text;
alter table public.exams add column if not exists board_id uuid references public.exam_boards(id) on delete set null;
alter table public.exams add column if not exists test_date date;
alter table public.exams add column if not exists notice_status text not null default 'published'
  check (notice_status in ('forecast','draft','published','closed'));
alter table public.exams add column if not exists has_taf boolean not null default false;

create unique index if not exists exams_slug_unique on public.exams(slug) where slug is not null;

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  version_label text not null,
  source_url text,
  storage_path text,
  file_hash text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','extracting','needs_review','validated','failed')),
  extraction_confidence numeric(4,3) check (extraction_confidence between 0 and 1),
  structured_data jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_topics (
  exam_id uuid not null references public.exams(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  weight numeric(8,4) not null default 1 check (weight >= 0),
  historical_frequency numeric(5,4) check (historical_frequency between 0 and 1),
  expected_questions numeric(6,2) check (expected_questions >= 0),
  is_eliminatory boolean not null default false,
  source_notice_id uuid references public.notices(id) on delete set null,
  primary key (exam_id, topic_id)
);

create table if not exists public.user_exams (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  priority text not null default 'principal'
    check (priority in ('principal','secondary','watching','archived')),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exam_id)
);

alter table public.questions add column if not exists source_type text not null default 'official_exam'
  check (source_type in ('official_exam','licensed','public_source','ai_generated','manually_created'));
alter table public.questions add column if not exists ai_generated boolean not null default false;
alter table public.questions add column if not exists validation_status text not null default 'pending'
  check (validation_status in ('pending','approved','contested','rejected'));

create table if not exists public.question_topics (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  relevance numeric(4,3) not null default 1 check (relevance between 0 and 1),
  primary key (question_id, topic_id)
);

create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option integer not null check (selected_option >= 0),
  is_correct boolean,
  response_time_ms integer check (response_time_ms >= 0),
  answer_context text not null default 'practice'
    check (answer_context in ('diagnostic','practice','simulation','review')),
  answered_at timestamptz not null default now()
);

create table if not exists public.topic_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  mastery_score numeric(5,4) not null default 0.5 check (mastery_score between 0 and 1),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  wrong_answers integer not null default 0 check (wrong_answers >= 0),
  average_response_time_ms integer check (average_response_time_ms >= 0),
  last_question_at timestamptz,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  status text not null default 'started' check (status in ('started','completed','abandoned')),
  readiness_score numeric(5,2) check (readiness_score between 0 and 100),
  confidence numeric(5,4) check (confidence between 0 and 1),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  mode text not null default 'pre_notice'
    check (mode in ('exploration','pre_notice','published_notice','final_sprint','post_exam')),
  starts_on date not null,
  ends_on date not null,
  weekly_minutes integer not null check (weekly_minutes > 0),
  generation_reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  task_type text not null check (task_type in ('theory','questions','review','simulation','writing','taf','weekly_checkin')),
  title text not null,
  planned_minutes integer not null check (planned_minutes > 0),
  scheduled_for timestamptz,
  priority_score numeric(5,2) check (priority_score between 0 and 100),
  status text not null default 'planned' check (status in ('planned','started','completed','skipped','rescheduled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  due_at timestamptz not null,
  interval_days integer not null default 1 check (interval_days > 0),
  recurrence_count integer not null default 0 check (recurrence_count >= 0),
  status text not null default 'pending' check (status in ('pending','completed','snoozed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  action_type text not null,
  priority_score numeric(5,2) not null check (priority_score between 0 and 100),
  expected_gain_band text check (expected_gain_band in ('low','moderate','high')),
  factors jsonb not null default '{}'::jsonb,
  explanation text not null,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  planned_minutes integer not null default 0,
  completed_minutes integer not null default 0,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  reflection jsonb not null default '{}'::jsonb,
  rota_score numeric(5,2) check (rota_score between 0 and 100),
  completed_at timestamptz,
  unique (user_id, week_start)
);

create table if not exists public.notice_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  file_size integer not null check (file_size > 0 and file_size <= 15728640),
  file_hash text not null,
  page_count integer check (page_count > 0 and page_count <= 400),
  extracted_text text,
  structured_data jsonb not null default '{}'::jsonb,
  extraction_confidence numeric(4,3) check (extraction_confidence between 0 and 1),
  status text not null default 'uploaded' check (status in ('uploaded','extracting','needs_ocr','needs_review','validated','rejected','failed')),
  processing_error text,
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  validated_notice_id uuid references public.notices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

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

-- Snapshot transacional do motor adaptativo. Mantém o estado do candidato
-- consistente enquanto as projeções analíticas permanecem normalizadas nas
-- tabelas de domínio acima.
create table if not exists public.candidate_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_version integer not null default 3 check (state_version > 0),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_answers_user_date_idx on public.user_answers(user_id, answered_at desc);
create index if not exists topic_mastery_user_score_idx on public.topic_mastery(user_id, mastery_score);
create index if not exists study_tasks_user_schedule_idx on public.study_tasks(user_id, scheduled_for);
create index if not exists review_queue_user_due_idx on public.review_queue(user_id, due_at) where status = 'pending';
create index if not exists recommendations_user_date_idx on public.recommendations(user_id, created_at desc);

alter table public.exam_boards enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.notices enable row level security;
alter table public.exam_topics enable row level security;
alter table public.user_exams enable row level security;
alter table public.question_topics enable row level security;
alter table public.user_answers enable row level security;
alter table public.topic_mastery enable row level security;
alter table public.diagnostics enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.review_queue enable row level security;
alter table public.recommendations enable row level security;
alter table public.weekly_checkins enable row level security;
alter table public.candidate_states enable row level security;
alter table public.notice_submissions enable row level security;
alter table public.ai_interactions enable row level security;

drop policy if exists "catalog_boards_read" on public.exam_boards;
create policy "catalog_boards_read" on public.exam_boards for select using (true);
drop policy if exists "catalog_subjects_read" on public.subjects;
create policy "catalog_subjects_read" on public.subjects for select using (true);
drop policy if exists "catalog_topics_read" on public.topics;
create policy "catalog_topics_read" on public.topics for select using (true);
drop policy if exists "catalog_exam_topics_read" on public.exam_topics;
create policy "catalog_exam_topics_read" on public.exam_topics for select using (true);
drop policy if exists "catalog_question_topics_read" on public.question_topics;
create policy "catalog_question_topics_read" on public.question_topics for select using (true);
drop policy if exists "validated_notices_read" on public.notices;
create policy "validated_notices_read" on public.notices for select using (extraction_status = 'validated');

drop policy if exists "user_exams_own_all" on public.user_exams;
create policy "user_exams_own_all" on public.user_exams for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_answers_own_all" on public.user_answers;
create policy "user_answers_own_all" on public.user_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "topic_mastery_own_all" on public.topic_mastery;
create policy "topic_mastery_own_all" on public.topic_mastery for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "diagnostics_own_all" on public.diagnostics;
create policy "diagnostics_own_all" on public.diagnostics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "study_plans_own_all" on public.study_plans;
create policy "study_plans_own_all" on public.study_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "study_tasks_own_all" on public.study_tasks;
create policy "study_tasks_own_all" on public.study_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "review_queue_own_all" on public.review_queue;
create policy "review_queue_own_all" on public.review_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recommendations_own_all" on public.recommendations;
create policy "recommendations_own_all" on public.recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "weekly_checkins_own_all" on public.weekly_checkins;
create policy "weekly_checkins_own_all" on public.weekly_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "candidate_states_own_all" on public.candidate_states;
create policy "candidate_states_own_all" on public.candidate_states for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "notice_submissions_select_own" on public.notice_submissions;
create policy "notice_submissions_select_own" on public.notice_submissions for select using (auth.uid() = user_id);
drop policy if exists "ai_interactions_select_own" on public.ai_interactions;
create policy "ai_interactions_select_own" on public.ai_interactions for select using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notice-submissions', 'notice-submissions', false, 15728640, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.subjects (stable_code, name, slug) values
  ('LING', 'Linguagens', 'linguagens'),
  ('RLM', 'Raciocínio Lógico', 'raciocinio-logico'),
  ('DIR', 'Direito', 'direito'),
  ('LEG', 'Legislação Policial', 'legislacao-policial'),
  ('GERAL', 'Conhecimentos Gerais', 'conhecimentos-gerais')
on conflict (stable_code) do update set name = excluded.name, slug = excluded.slug;

insert into public.topics (subject_id, stable_code, name, slug, depth)
select id, 'LING.INTERPRETACAO', 'Interpretação textual', 'interpretacao-textual', 0 from public.subjects where stable_code = 'LING'
on conflict (stable_code) do update set name = excluded.name;
insert into public.topics (subject_id, stable_code, name, slug, depth)
select id, 'RLM.PROPOSICOES', 'Proposições', 'proposicoes', 0 from public.subjects where stable_code = 'RLM'
on conflict (stable_code) do update set name = excluded.name;
insert into public.topics (subject_id, stable_code, name, slug, depth)
select id, 'CONST.DIREITOS_FUNDAMENTAIS', 'Direitos fundamentais', 'direitos-fundamentais', 0 from public.subjects where stable_code = 'DIR'
on conflict (stable_code) do update set name = excluded.name;
insert into public.topics (subject_id, stable_code, name, slug, depth)
select id, 'LEG.ETICA_DISCIPLINA', 'Ética e disciplina', 'etica-disciplina', 0 from public.subjects where stable_code = 'LEG'
on conflict (stable_code) do update set name = excluded.name;
insert into public.topics (subject_id, stable_code, name, slug, depth)
select id, 'GERAL.CIDADANIA', 'Cidadania e atualidades', 'cidadania-atualidades', 0 from public.subjects where stable_code = 'GERAL'
on conflict (stable_code) do update set name = excluded.name;

-- Opportunity Engine: catálogo de trilhas e interesses privados do candidato.
create table if not exists public.career_tracks (
  code text primary key,
  title text not null,
  institution text not null,
  area text not null check (area in ('policial','juridica','fiscal','administrativa')),
  scope text not null,
  education_requirement text not null check (education_requirement in ('medio','superior')),
  has_physical_test boolean not null default false,
  summary text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_track_topics (
  track_code text not null references public.career_tracks(code) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  weight numeric(5,4) not null check (weight > 0 and weight <= 1),
  primary key (track_code, topic_id)
);

create table if not exists public.user_career_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_code text not null references public.career_tracks(code) on delete cascade,
  status text not null default 'watching' check (status in ('watching','secondary')),
  compatibility_score numeric(5,2) not null check (compatibility_score between 0 and 100),
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_code)
);

create index if not exists user_career_tracks_status_idx
  on public.user_career_tracks(user_id, status, updated_at desc);

alter table public.career_tracks enable row level security;
alter table public.career_track_topics enable row level security;
alter table public.user_career_tracks enable row level security;

drop policy if exists "career_tracks_read" on public.career_tracks;
create policy "career_tracks_read" on public.career_tracks for select using (active);
drop policy if exists "career_track_topics_read" on public.career_track_topics;
create policy "career_track_topics_read" on public.career_track_topics for select using (true);
drop policy if exists "user_career_tracks_own_all" on public.user_career_tracks;
drop policy if exists "user_career_tracks_select_own" on public.user_career_tracks;
create policy "user_career_tracks_select_own" on public.user_career_tracks for select
using (auth.uid() = user_id);

-- O cálculo e as escritas passam pela API server-side para impedir que o
-- cliente altere artificialmente a própria pontuação de compatibilidade.

insert into public.career_tracks (code, title, institution, area, scope, education_requirement, has_physical_test, summary) values
  ('pmmg-cfsd','Polícia Militar — Soldado','Polícias Militares','policial','Estadual','medio',true,'Trilha-base para carreiras policiais militares, sujeita ao edital de cada estado.'),
  ('pmmg-cfo','Polícia Militar — Oficial','Polícias Militares','policial','Estadual','superior',true,'Trilha de formação de oficiais com maior ênfase jurídica e requisitos definidos por edital.'),
  ('federal-police','Carreiras policiais federais','Órgãos policiais federais','policial','Federal','superior',true,'Base de conhecimentos reaproveitável; cargos, etapas e requisitos variam por órgão e edital.'),
  ('courts','Tribunais','Tribunais e órgãos jurídicos','juridica','Nacional','medio',false,'Trilha geral para áreas administrativa e judiciária, sem representar um edital específico.'),
  ('fiscal','Carreira fiscal','Fiscos estaduais e municipais','fiscal','Nacional','superior',false,'Núcleo comum inicial para fiscos; disciplinas especializadas entram após a escolha do edital.'),
  ('administrative','Área administrativa','Órgãos públicos diversos','administrativa','Nacional','medio',false,'Trilha exploratória de alta reutilização para quem ainda está escolhendo um órgão.')
on conflict (code) do update set
  title = excluded.title, institution = excluded.institution, area = excluded.area,
  scope = excluded.scope, education_requirement = excluded.education_requirement,
  has_physical_test = excluded.has_physical_test, summary = excluded.summary,
  active = true, updated_at = now();

insert into public.career_track_topics (track_code, topic_id, weight)
select valueset.track_code, topics.id, valueset.weight
from (values
  ('pmmg-cfsd','LING.INTERPRETACAO',.75),('pmmg-cfsd','RLM.PROPOSICOES',.70),('pmmg-cfsd','CONST.DIREITOS_FUNDAMENTAIS',.90),('pmmg-cfsd','LEG.ETICA_DISCIPLINA',1.00),('pmmg-cfsd','GERAL.CIDADANIA',.65),
  ('pmmg-cfo','LING.INTERPRETACAO',.80),('pmmg-cfo','RLM.PROPOSICOES',.55),('pmmg-cfo','CONST.DIREITOS_FUNDAMENTAIS',1.00),('pmmg-cfo','LEG.ETICA_DISCIPLINA',.90),('pmmg-cfo','GERAL.CIDADANIA',.60),
  ('federal-police','LING.INTERPRETACAO',.80),('federal-police','RLM.PROPOSICOES',.85),('federal-police','CONST.DIREITOS_FUNDAMENTAIS',1.00),('federal-police','LEG.ETICA_DISCIPLINA',.65),('federal-police','GERAL.CIDADANIA',.45),
  ('courts','LING.INTERPRETACAO',1.00),('courts','RLM.PROPOSICOES',.65),('courts','CONST.DIREITOS_FUNDAMENTAIS',.90),('courts','LEG.ETICA_DISCIPLINA',.25),('courts','GERAL.CIDADANIA',.35),
  ('fiscal','LING.INTERPRETACAO',.70),('fiscal','RLM.PROPOSICOES',1.00),('fiscal','CONST.DIREITOS_FUNDAMENTAIS',.70),('fiscal','LEG.ETICA_DISCIPLINA',.15),('fiscal','GERAL.CIDADANIA',.35),
  ('administrative','LING.INTERPRETACAO',1.00),('administrative','RLM.PROPOSICOES',.80),('administrative','CONST.DIREITOS_FUNDAMENTAIS',.60),('administrative','LEG.ETICA_DISCIPLINA',.30),('administrative','GERAL.CIDADANIA',.55)
) as valueset(track_code, topic_code, weight)
join public.topics on topics.stable_code = valueset.topic_code
on conflict (track_code, topic_id) do update set weight = excluded.weight;

-- Central de conhecimento: proveniência manual/web, lotes e revisão humana.
alter table public.questions drop constraint if exists questions_source_type_check;
alter table public.questions add constraint questions_source_type_check check (source_type in ('official_exam','licensed','public_source','ai_generated','manually_created','web_researched'));
alter table public.questions add column if not exists ingestion_origin text not null default 'legacy' check (ingestion_origin in ('legacy','manual','file_import','web_researched'));
alter table public.questions add column if not exists generation_model text;
alter table public.questions add column if not exists provenance jsonb not null default '{}'::jsonb;

create table if not exists public.question_import_batches (
  id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id) on delete restrict,
  origin text not null check (origin in ('manual','file_import','web_researched')), provider text, model text, query text,
  search_filters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','searching','needs_review','completed','failed')),
  source_count integer not null default 0 check (source_count >= 0), candidate_count integer not null default 0 check (candidate_count >= 0),
  processing_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(), batch_id uuid references public.question_import_batches(id) on delete cascade,
  origin text not null check (origin in ('manual','file_import','web_researched')), provider text, title text not null, url text, publisher text,
  published_at timestamptz, retrieved_at timestamptz not null default now(), excerpt text,
  rights_status text not null default 'unknown' check (rights_status in ('unknown','official','public_domain','authorized','restricted')),
  content_hash text not null, metadata jsonb not null default '{}'::jsonb, created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create unique index if not exists content_sources_batch_url_idx on public.content_sources(batch_id, url) where url is not null;
create index if not exists content_sources_batch_idx on public.content_sources(batch_id, created_at);
create table if not exists public.question_candidates (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.question_import_batches(id) on delete cascade,
  origin text not null check (origin in ('manual','file_import','web_researched')), exam_id uuid references public.exams(id) on delete set null,
  axis_id uuid references public.question_axes(id) on delete set null, topic_id uuid references public.topics(id) on delete set null,
  subject text not null, topic text, statement text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5),
  correct_option integer not null check (correct_option between 0 and 4), explanation text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')), content_hash text not null unique,
  generation_model text, prompt_version text, provenance jsonb not null default '{}'::jsonb,
  status text not null default 'needs_review' check (status in ('needs_review','approved','rejected','duplicate')),
  published_question_id uuid references public.questions(id) on delete set null, reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.question_candidate_sources (
  candidate_id uuid not null references public.question_candidates(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  relation text not null default 'research_context' check (relation in ('research_context','direct_support','original_question')),
  primary key (candidate_id, source_id)
);
create table if not exists public.question_source_links (
  question_id uuid not null references public.questions(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete restrict,
  relation text not null default 'research_context' check (relation in ('research_context','direct_support','original_question')),
  primary key (question_id, source_id)
);
create index if not exists question_candidates_review_idx on public.question_candidates(status, created_at);
create index if not exists question_import_batches_status_idx on public.question_import_batches(status, created_at desc);
alter table public.question_import_batches enable row level security;
alter table public.content_sources enable row level security;
alter table public.question_candidates enable row level security;
alter table public.question_candidate_sources enable row level security;
alter table public.question_source_links enable row level security;
insert into public.question_axes (name, slug, display_order) values
  ('Redação','redacao',60),('Matemática','matematica',70),('Ciências Humanas','ciencias-humanas',80),('Ciências da Natureza','ciencias-da-natureza',90)
on conflict (slug) do update set name = excluded.name, display_order = excluded.display_order;

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

-- Operação do piloto: planos internos, consumo e observabilidade sem gateway acoplado.
create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  entitlements jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code) on delete restrict,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','expired')),
  provider text not null default 'internal',
  external_customer_id text,
  external_subscription_id text,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscriptions_one_current_idx
  on public.user_subscriptions(user_id) where status in ('trialing','active');

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('mentor_request','notice_upload')),
  quantity integer not null default 1 check (quantity > 0),
  request_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, metric, request_id)
);

create table if not exists public.operational_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  route text not null,
  event_type text not null,
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_metric_date_idx on public.usage_events(user_id, metric, created_at desc);
create index if not exists operational_events_route_date_idx on public.operational_events(route, created_at desc);
create index if not exists operational_events_status_date_idx on public.operational_events(status_code, created_at desc);

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.operational_events enable row level security;

drop policy if exists "subscription_plans_read" on public.subscription_plans;
create policy "subscription_plans_read" on public.subscription_plans for select using (active);
drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own" on public.user_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events for select using (auth.uid() = user_id);

-- operational_events não tem política pública: leitura somente via API de admin.
insert into public.subscription_plans (code, name, price_cents, entitlements) values
  ('free','Gratuito',0,'{"mentorDailyRequests":5,"noticeMonthlyUploads":1,"noticeMaxBytes":10485760,"opportunityTracking":true,"physicalHistory":true}'::jsonb),
  ('pilot','Piloto',0,'{"mentorDailyRequests":30,"noticeMonthlyUploads":5,"noticeMaxBytes":15728640,"opportunityTracking":true,"physicalHistory":true}'::jsonb),
  ('pro','Rota Pro',2990,'{"mentorDailyRequests":100,"noticeMonthlyUploads":20,"noticeMaxBytes":15728640,"opportunityTracking":true,"physicalHistory":true}'::jsonb)
on conflict (code) do update set name = excluded.name, price_cents = excluded.price_cents, entitlements = excluded.entitlements, active = true, updated_at = now();

-- ENEM 2026: objetivo nacional, calendário oficial e taxonomia inicial.
alter table public.career_tracks drop constraint if exists career_tracks_area_check;
alter table public.career_tracks add constraint career_tracks_area_check check (area in ('policial','juridica','fiscal','administrativa','educacional'));
alter table public.career_tracks drop constraint if exists career_tracks_education_requirement_check;
alter table public.career_tracks add constraint career_tracks_education_requirement_check check (education_requirement in ('none','medio','superior'));
alter table public.career_tracks add column if not exists exam_date date;
alter table public.career_tracks add column if not exists secondary_exam_date date;
alter table public.career_tracks add column if not exists official_source_url text;
alter table public.career_tracks add column if not exists official_data_checked_at timestamptz;

insert into public.subjects (stable_code, name, slug) values
  ('RED','Redação','redacao'),('MAT','Matemática','matematica'),
  ('HUM','Ciências Humanas','ciencias-humanas'),('NAT','Ciências da Natureza','ciencias-da-natureza')
on conflict (stable_code) do update set name = excluded.name, slug = excluded.slug;

insert into public.topics (subject_id, stable_code, name, slug, depth)
select subjects.id, valueset.stable_code, valueset.name, valueset.slug, 0
from (values
  ('RED','RED.COMPETENCIAS','Texto dissertativo-argumentativo','texto-dissertativo-argumentativo'),
  ('MAT','MAT.PROBLEMAS','Resolução de problemas','resolucao-de-problemas'),
  ('HUM','HUM.HISTORIA','História e processos sociais','historia-processos-sociais'),
  ('HUM','HUM.GEOGRAFIA','Geografia e espaço brasileiro','geografia-espaco-brasileiro'),
  ('HUM','HUM.FILOSOFIA_SOCIOLOGIA','Filosofia e sociologia','filosofia-sociologia'),
  ('NAT','NAT.BIOLOGIA','Biologia','biologia'),('NAT','NAT.FISICA','Física','fisica'),
  ('NAT','NAT.QUIMICA','Química','quimica')
) as valueset(subject_code, stable_code, name, slug)
join public.subjects on subjects.stable_code = valueset.subject_code
on conflict (stable_code) do update set name = excluded.name, slug = excluded.slug;

insert into public.career_tracks (code,title,institution,area,scope,education_requirement,has_physical_test,summary,exam_date,secondary_exam_date,official_source_url,official_data_checked_at)
values ('enem-2026','ENEM 2026','Inep','educacional','Nacional','none',false,'Aplicação regular em 8 e 15 de novembro de 2026, com quatro áreas do conhecimento, 180 questões objetivas e redação.','2026-11-08','2026-11-15','https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/orientacoes/cronograma',now())
on conflict (code) do update set title=excluded.title,institution=excluded.institution,area=excluded.area,scope=excluded.scope,education_requirement=excluded.education_requirement,has_physical_test=excluded.has_physical_test,summary=excluded.summary,exam_date=excluded.exam_date,secondary_exam_date=excluded.secondary_exam_date,official_source_url=excluded.official_source_url,official_data_checked_at=excluded.official_data_checked_at,active=true,updated_at=now();

insert into public.career_track_topics (track_code, topic_id, weight)
select 'enem-2026', topics.id, valueset.weight from (values
  ('LING.INTERPRETACAO',1.00),('RED.COMPETENCIAS',1.00),('MAT.PROBLEMAS',1.00),
  ('HUM.HISTORIA',.86),('HUM.GEOGRAFIA',.86),('HUM.FILOSOFIA_SOCIOLOGIA',.72),
  ('NAT.BIOLOGIA',.86),('NAT.FISICA',.86),('NAT.QUIMICA',.86)
) as valueset(topic_code, weight) join public.topics on topics.stable_code = valueset.topic_code
on conflict (track_code, topic_id) do update set weight = excluded.weight;
