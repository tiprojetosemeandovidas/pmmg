-- Fundação idempotente exigida pelas migrations históricas 001..008.
-- Mantém ambientes novos compatíveis sem depender de execução manual de schema.sql.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  exam_cycle text not null default 'pre_notice',
  weekly_goal_minutes integer not null default 420 check (weekly_goal_minutes > 0),
  pilot_status text not null default 'invited'
    check (pilot_status in ('invited','active','suspended','finished')),
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
  status text not null default 'planned'
    check (status in ('planned','started','completed','missed')),
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
  level text not null check (level in ('high','medium','maintenance')),
  evidence jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (user_id, subject)
);

create table if not exists public.question_axes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  display_order integer not null default 0
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  state char(2) not null,
  role text not null,
  exam_year integer not null check (exam_year between 1900 and 2100),
  organizer text,
  source_url text not null,
  authorization_reference text not null,
  status text not null default 'review'
    check (status in ('review','published','unpublished')),
  unique (institution, state, role, exam_year, organizer)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  axis_id uuid not null references public.question_axes(id) on delete restrict,
  subject text not null,
  topic text,
  statement text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_option integer,
  explanation text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  source_page integer,
  content_hash text not null unique,
  status text not null default 'review'
    check (status in ('review','published','rejected','unpublished')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.priority_map enable row level security;
alter table public.question_axes enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "sessions_select_own" on public.study_sessions;
create policy "sessions_select_own" on public.study_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.study_sessions;
create policy "sessions_insert_own" on public.study_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.study_sessions;
create policy "sessions_update_own" on public.study_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "priorities_select_own" on public.priority_map;
create policy "priorities_select_own" on public.priority_map
  for select using (auth.uid() = user_id);
drop policy if exists "axes_read_authenticated" on public.question_axes;
create policy "axes_read_authenticated" on public.question_axes
  for select to authenticated using (true);
drop policy if exists "published_exams_read_authenticated" on public.exams;
create policy "published_exams_read_authenticated" on public.exams
  for select to authenticated using (status = 'published');
drop policy if exists "published_questions_read_authenticated" on public.questions;
create policy "published_questions_read_authenticated" on public.questions
  for select to authenticated using (status = 'published');

insert into public.question_axes (name, slug, display_order) values
  ('Linguagens','linguagens',10),
  ('Raciocínio Lógico','raciocinio-logico',20),
  ('Direito','direito',30),
  ('Legislação Policial','legislacao-policial',40),
  ('Conhecimentos Gerais','conhecimentos-gerais',50)
on conflict (slug) do update
set name = excluded.name, display_order = excluded.display_order;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
