-- Fechamento da Fase 4: endurece idempotência e capacidade do diagnóstico.
-- Substitui somente a função; dados e histórico da migration 004 são preservados.

create unique index if not exists user_answers_one_per_diagnostic_question_idx
  on public.user_answers(user_id, diagnostic_session_id, question_id)
  where diagnostic_session_id is not null;

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
  v_original_question public.questions%rowtype;
  v_answer_id uuid;
  v_correct boolean;
  v_existing public.user_answers%rowtype;
  v_seconds numeric;
  v_diagnostic public.diagnostic_sessions%rowtype;
begin
  if p_response_time_ms is not null and (p_response_time_ms < 0 or p_response_time_ms > 3600000) then
    raise exception 'invalid_response_time';
  end if;

  -- Um retry legítimo deve repetir a mesma intenção. Nunca usa a questão nova
  -- para montar a resposta de uma chave já consumida.
  select * into v_existing from public.user_answers
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.question_id <> p_question_id
      or v_existing.selected_option <> p_selected_option
      or v_existing.diagnostic_session_id is distinct from p_diagnostic_session_id then
      raise exception 'idempotency_conflict';
    end if;
    select * into v_original_question from public.questions where id = v_existing.question_id;
    return query select v_existing.id, v_existing.is_correct,
      v_original_question.correct_option::smallint, v_original_question.explanation, true;
    return;
  end if;

  select * into v_question from public.questions
  where id = p_question_id and status = 'published' and validation_status = 'validated';
  if not found then raise exception 'question_not_available'; end if;
  if not exists (
    select 1 from public.question_options
    where question_id = p_question_id and option_index = p_selected_option
  ) then raise exception 'invalid_selected_option'; end if;

  if p_diagnostic_session_id is not null then
    select * into v_diagnostic from public.diagnostic_sessions
    where id = p_diagnostic_session_id and user_id = p_user_id and status = 'in_progress'
    for update;
    if not found then raise exception 'diagnostic_not_available'; end if;
    if v_diagnostic.answered_count >= v_diagnostic.question_count then
      raise exception 'diagnostic_full';
    end if;
    if exists (
      select 1 from public.user_answers
      where user_id = p_user_id
        and diagnostic_session_id = p_diagnostic_session_id
        and question_id = p_question_id
    ) then raise exception 'diagnostic_question_already_answered'; end if;
  end if;

  v_correct := p_selected_option = v_question.correct_option;
  insert into public.user_answers (
    user_id, question_id, diagnostic_session_id, selected_option, is_correct,
    response_time_ms, idempotency_key
  ) values (
    p_user_id, p_question_id, p_diagnostic_session_id, p_selected_option, v_correct,
    p_response_time_ms, p_idempotency_key
  ) on conflict (user_id, idempotency_key) do nothing returning id into v_answer_id;

  -- Protege também retries concorrentes que chegaram antes do primeiro commit.
  if v_answer_id is null then
    select * into v_existing from public.user_answers
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if v_existing.question_id <> p_question_id
      or v_existing.selected_option <> p_selected_option
      or v_existing.diagnostic_session_id is distinct from p_diagnostic_session_id then
      raise exception 'idempotency_conflict';
    end if;
    select * into v_original_question from public.questions where id = v_existing.question_id;
    return query select v_existing.id, v_existing.is_correct,
      v_original_question.correct_option::smallint, v_original_question.explanation, true;
    return;
  end if;

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
