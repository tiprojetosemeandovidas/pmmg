do $$
begin
  if pg_get_functiondef('public.record_question_answer(uuid,uuid,smallint,uuid,integer,uuid)'::regprocedure)
    not like '%idempotency_conflict%' then
    raise exception 'Candidate Model sem proteção de conflito idempotente';
  end if;
  if pg_get_functiondef('public.record_question_answer(uuid,uuid,smallint,uuid,integer,uuid)'::regprocedure)
    not like '%diagnostic_full%' then
    raise exception 'Candidate Model sem limite de diagnóstico';
  end if;
  if to_regclass('public.user_answers_one_per_diagnostic_question_idx') is null then
    raise exception 'Candidate Model permite repetir questão no mesmo diagnóstico';
  end if;
  raise notice 'Candidate Model hardening: idempotência e capacidade verificadas.';
end $$;
