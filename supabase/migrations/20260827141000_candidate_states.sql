-- Snapshot transacional do motor adaptativo com isolamento por usuário.
create table if not exists public.candidate_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_version integer not null default 3 check (state_version > 0),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_states enable row level security;

drop policy if exists "candidate_states_own_all" on public.candidate_states;
create policy "candidate_states_own_all"
on public.candidate_states
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
