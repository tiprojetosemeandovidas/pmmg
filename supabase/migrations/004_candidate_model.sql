-- Rota V2 / Fase 4: Candidate Model.
-- Execute após 003_question_engine.sql. Respostas são imutáveis e o gabarito
-- permanece exclusivamente no banco/server-side.

create table if not exists public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  question_count integer not null default 20 check (question_count between 5 and 100),
  answered_count integer not null default 0 check (answered_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (correct_count <= answered_count),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create index if not exists diagnostic_sessions_user_idx
  on public.diagnostic_sessions(user_id, started_at desc);

create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  diagnostic_session_id uuid references public.diagnostic_sessions(id) on delete set null,
  selected_option smallint not null check (selected_option between 0 and 25),
  is_correct boolean not null,
  response_time_ms integer check (response_time_ms is null or response_time_ms between 0 and 3600000),
  idempotency_key uuid not null,
  answered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, idempotency_key)
);

create index if not exists user_answers_user_time_idx
  on public.user_answers(user_id, answered_at desc);
create index if not exists user_answers_question_idx
  on public.user_answers(question_id);
create index if not exists user_answers_diagnostic_idx
  on public.user_answers(diagnostic_session_id) where diagnostic_session_id is not null;

alter table public.diagnostic_sessions enable row level security;
alter table public.user_answers enable row level security;

drop policy if exists "diagnostic_sessions_select_own" on public.diagnostic_sessions;
create policy "diagnostic_sessions_select_own" on public.diagnostic_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "user_answers_select_own" on public.user_answers;
create policy "user_answers_select_own" on public.user_answers
  for select using (auth.uid() = user_id);

-- Chamado somente pela API server-side com service_role. A operação é
-- idempotente e atualiza resposta, diagnóstico e domínio na mesma transação.
create or replace function public.record_question_answer(
  p_user_id uuid,
  p_question_id uuid,
  p_selected_option smallint,
  p_idempotency_key uuid,
  p_response_time_ms integer default null,
  p_diagnostic_session_id uuid default null
)
returns table (
  answer_id uuid,
  correct boolean,
  correct_option smallint,
  explanation text,
  already_recorded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
  v_answer_id uuid;
  v_correct boolean;
  v_existing public.user_answers%rowtype;
  v_seconds numeric;
begin
  if p_response_time_ms is not null and (p_response_time_ms < 0 or p_response_time_ms > 3600000) then
    raise exception 'invalid_response_time';
  end if;

  select * into v_question from public.questions
  where id = p_question_id and status = 'published' and validation_status = 'validated';
  if not found then raise exception 'question_not_available'; end if;
  if not exists (
    select 1 from public.question_options
    where question_id = p_question_id and option_index = p_selected_option
  ) then raise exception 'invalid_selected_option'; end if;
  if p_diagnostic_session_id is not null and not exists (
    select 1 from public.diagnostic_sessions
    where id = p_diagnostic_session_id and user_id = p_user_id and status = 'in_progress'
  ) then raise exception 'diagnostic_not_available'; end if;

  select * into v_existing from public.user_answers
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.is_correct,
      v_question.correct_option::smallint, v_question.explanation, true;
    return;
  end if;

  v_correct := p_selected_option = v_question.correct_option;
  insert into public.user_answers (
    user_id, question_id, diagnostic_session_id, selected_option, is_correct,
    response_time_ms, idempotency_key
  ) values (
    p_user_id, p_question_id, p_diagnostic_session_id, p_selected_option, v_correct,
    p_response_time_ms, p_idempotency_key
  ) returning id into v_answer_id;

  v_seconds := case when p_response_time_ms is null then null else p_response_time_ms / 1000.0 end;
  insert into public.topic_mastery (
    user_id, topic_id, mastery_score, confidence, questions_answered,
    correct_answers, wrong_answers, last_studied_at, last_question_at,
    average_response_time_seconds, streak, model_version, updated_at
  )
  select p_user_id, qt.topic_id, case when v_correct then 100 else 0 end,
    0.05, 1, case when v_correct then 1 else 0 end,
    case when v_correct then 0 else 1 end, now(), now(), v_seconds,
    case when v_correct then 1 else 0 end, 'candidate-v1', now()
  from public.question_topics qt where qt.question_id = p_question_id
  on conflict (user_id, topic_id) do update set
    mastery_score = round((public.topic_mastery.correct_answers + case when v_correct then 1 else 0 end)::numeric * 100 /
      (public.topic_mastery.questions_answered + 1), 2),
    confidence = least(1, (public.topic_mastery.questions_answered + 1) / 20.0),
    questions_answered = public.topic_mastery.questions_answered + 1,
    correct_answers = public.topic_mastery.correct_answers + case when v_correct then 1 else 0 end,
    wrong_answers = public.topic_mastery.wrong_answers + case when v_correct then 0 else 1 end,
    last_studied_at = now(), last_question_at = now(),
    average_response_time_seconds = case
      when v_seconds is null then public.topic_mastery.average_response_time_seconds
      when public.topic_mastery.average_response_time_seconds is null then v_seconds
      else round((public.topic_mastery.average_response_time_seconds * public.topic_mastery.questions_answered + v_seconds) /
        (public.topic_mastery.questions_answered + 1), 2) end,
    streak = case when v_correct then public.topic_mastery.streak + 1 else 0 end,
    model_version = 'candidate-v1', updated_at = now();

  if p_diagnostic_session_id is not null then
    update public.diagnostic_sessions set
      answered_count = answered_count + 1,
      correct_count = correct_count + case when v_correct then 1 else 0 end,
      updated_at = now()
    where id = p_diagnostic_session_id;
  end if;

  return query select v_answer_id, v_correct, v_question.correct_option::smallint,
    v_question.explanation, false;
end;
$$;

revoke all on function public.record_question_answer(uuid, uuid, smallint, uuid, integer, uuid) from public;
grant execute on function public.record_question_answer(uuid, uuid, smallint, uuid, integer, uuid) to service_role;

comment on table public.user_answers is 'Histórico imutável de respostas do candidato; escrita somente pela API autenticada.';
comment on table public.diagnostic_sessions is 'Sessões diagnósticas que consolidam evidências para o Candidate Model.';
