-- Telemetria mínima e auditável para acompanhar o piloto ENEM sem registrar conteúdo sensível.
create table if not exists public.pilot_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'onboarding_completed','diagnostic_started','diagnostic_completed','question_answered',
    'task_completed','weekly_checkin_completed','review_completed','notification_opened'
  )),
  event_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  client_occurred_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists pilot_events_type_date_idx on public.pilot_events(event_type, created_at desc);
create index if not exists pilot_events_user_date_idx on public.pilot_events(user_id, created_at desc);

alter table public.pilot_events enable row level security;
drop policy if exists "pilot_events_select_own" on public.pilot_events;
create policy "pilot_events_select_own" on public.pilot_events for select using (auth.uid() = user_id);

comment on table public.pilot_events is 'Eventos de produto do piloto; metadados não devem conter respostas, textos ou dados pessoais.';
