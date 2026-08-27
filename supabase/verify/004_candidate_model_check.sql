-- Verificação somente leitura para executar após 004_candidate_model.sql.
do $$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.user_answers') is null then missing := array_append(missing, 'user_answers'); end if;
  if to_regclass('public.diagnostic_sessions') is null then missing := array_append(missing, 'diagnostic_sessions'); end if;
  if to_regprocedure('public.record_question_answer(uuid,uuid,smallint,uuid,integer,uuid)') is null then
    missing := array_append(missing, 'record_question_answer');
  end if;
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'user_answers' and rowsecurity) then
    missing := array_append(missing, 'user_answers RLS');
  end if;
  if cardinality(missing) > 0 then raise exception 'Candidate Model incompleto: %', array_to_string(missing, ', '); end if;
  raise notice 'Candidate Model: respostas, diagnósticos, domínio e RLS verificados.';
end $$;
