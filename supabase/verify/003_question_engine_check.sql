-- Verificação somente leitura para executar após 003_question_engine.sql.
do $$
declare
  missing text[] := array[]::text[];
  item text;
begin
  foreach item in array array['question_options', 'question_topics', 'question_sources'] loop
    if to_regclass('public.' || item) is null then missing := array_append(missing, item); end if;
  end loop;
  foreach item in array array['source_type', 'validation_status', 'search_document'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'questions' and column_name = item
    ) then missing := array_append(missing, 'questions.' || item); end if;
  end loop;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'questions_search_idx'
  ) then missing := array_append(missing, 'questions_search_idx'); end if;
  if cardinality(missing) > 0 then raise exception 'Question Engine incompleto: %', array_to_string(missing, ', '); end if;
  raise notice 'Question Engine: modelo, origens, tópicos e busca textual verificados.';
end $$;
