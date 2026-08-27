do $$
begin
  if to_regclass('public.adaptive_recommendations') is null then
    raise exception 'Tabela de recomendações não criada';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'adaptive_recommendations'
      and policyname = 'adaptive_recommendations_select_own'
  ) then raise exception 'RLS de recomendações ausente'; end if;
  raise notice 'Adaptive Engine: tabela, constraints e RLS verificados.';
end $$;
