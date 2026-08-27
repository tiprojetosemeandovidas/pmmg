-- Correções da auditoria da Fase 5: atualização atômica do snapshot adaptativo.

create or replace function public.replace_adaptive_recommendations(
  p_user_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then
    raise exception 'invalid_recommendations';
  end if;

  update public.adaptive_recommendations
  set status = 'dismissed', updated_at = now()
  where user_id = p_user_id and model_version = 'adaptive-v1' and status = 'active';

  insert into public.adaptive_recommendations (
    user_id, topic_id, exam_id, rank, action, priority_score, reason_code,
    reason, factors, evidence, model_version, status, generated_at, updated_at
  )
  select p_user_id, (item->>'topicId')::uuid,
    case when nullif(item->>'examId', '') is null then null else (item->>'examId')::uuid end,
    (item->>'rank')::smallint, item->>'action', (item->>'priorityScore')::numeric,
    item->>'reasonCode', item->>'reason', item->'factors', item->'evidence',
    'adaptive-v1', 'active', now(), now()
  from jsonb_array_elements(p_items) item
  on conflict (user_id, topic_id, model_version) do update set
    exam_id = excluded.exam_id, rank = excluded.rank, action = excluded.action,
    priority_score = excluded.priority_score, reason_code = excluded.reason_code,
    reason = excluded.reason, factors = excluded.factors, evidence = excluded.evidence,
    status = 'active', generated_at = excluded.generated_at, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.replace_adaptive_recommendations(uuid, jsonb) from public;
grant execute on function public.replace_adaptive_recommendations(uuid, jsonb) to service_role;
