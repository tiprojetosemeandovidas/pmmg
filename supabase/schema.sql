-- Execute no SQL Editor do Supabase. Todas as tabelas são isoladas por usuário.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  exam_cycle text not null default 'PMMG 2026',
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

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.priority_map enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "sessions_select_own" on public.study_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.study_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.study_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "priorities_select_own" on public.priority_map for select using (auth.uid() = user_id);

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
