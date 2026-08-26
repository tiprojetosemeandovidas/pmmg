-- Verificação somente leitura para executar após 002_edital_engine.sql.
do $$
declare
  missing text[] := array[]::text[];
  item text;
begin
  foreach item in array array[
    'notices', 'user_roles', 'notice_extraction_runs', 'notice_stages',
    'notice_chunks', 'notice_topic_mappings', 'api_rate_limits'
  ] loop
    if to_regclass('public.' || item) is null then missing := array_append(missing, item); end if;
  end loop;

  if to_regprocedure('public.consume_rate_limit(character,integer,integer)') is null then
    missing := array_append(missing, 'consume_rate_limit(char,integer,integer)');
  end if;
  if not exists (select 1 from storage.buckets where id = 'editais-private' and public = false) then
    missing := array_append(missing, 'bucket editais-private privado');
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notices' and column_name = 'review_status'
  ) then missing := array_append(missing, 'notices.review_status'); end if;

  if cardinality(missing) > 0 then raise exception 'Edital Engine incompleto: %', array_to_string(missing, ', '); end if;
  raise notice 'Edital Engine: schema, função de rate limit e bucket privado verificados.';
end $$;
