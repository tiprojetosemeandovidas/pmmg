do $$
begin
  if to_regprocedure('public.replace_adaptive_recommendations(uuid,jsonb)') is null then
    raise exception 'Snapshot adaptativo não é transacional';
  end if;
  raise notice 'Adaptive Engine hardening: substituição transacional verificada.';
end $$;
