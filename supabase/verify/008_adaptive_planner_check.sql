do $$
begin
  if to_regclass('public.study_plans') is null or to_regclass('public.plan_tasks') is null
    or to_regclass('public.review_queue') is null then raise exception 'Tabelas da Fase 6 ausentes'; end if;
  if to_regprocedure('public.replace_weekly_study_plan(uuid,date,integer,jsonb)') is null
    or to_regprocedure('public.advance_review_item(uuid,uuid)') is null then raise exception 'RPCs da Fase 6 ausentes'; end if;
  raise notice 'Fase 6: plano e revisão verificados.';
end $$;
