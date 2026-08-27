-- Rota V2 / Fase 6: planejador semanal e fila de revisões adaptativas.

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null, week_start date not null,
  weekly_minutes integer not null check (weekly_minutes between 60 and 2400),
  status text not null default 'active' check (status in ('active','completed','replaced')),
  model_version text not null default 'planner-v1', generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(user_id, week_start, model_version)
);
create table if not exists public.plan_tasks (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.study_plans(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  recommendation_id uuid references public.adaptive_recommendations(id) on delete set null,
  task_type text not null check (task_type in ('learn','practice','review')),
  scheduled_date date not null, planned_minutes integer not null check (planned_minutes between 20 and 240),
  display_order smallint not null check (display_order between 1 and 100), reason text not null,
  status text not null default 'planned' check (status in ('planned','started','completed','skipped')),
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(plan_id, display_order)
);
create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  source_answer_id uuid not null references public.user_answers(id) on delete cascade,
  interval_step smallint not null default 1 check (interval_step between 1 and 4),
  due_at timestamptz not null, status text not null default 'scheduled' check (status in ('scheduled','completed','skipped')),
  last_reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, source_answer_id)
);
create index if not exists study_plans_user_week_idx on public.study_plans(user_id, week_start desc);
create index if not exists plan_tasks_plan_date_idx on public.plan_tasks(plan_id, scheduled_date, display_order);
create index if not exists review_queue_user_due_idx on public.review_queue(user_id, status, due_at);

alter table public.study_plans enable row level security;
alter table public.plan_tasks enable row level security;
alter table public.review_queue enable row level security;
drop policy if exists "study_plans_select_own" on public.study_plans;
create policy "study_plans_select_own" on public.study_plans for select using (auth.uid() = user_id);
drop policy if exists "plan_tasks_select_own" on public.plan_tasks;
create policy "plan_tasks_select_own" on public.plan_tasks for select using (
  exists(select 1 from public.study_plans p where p.id = plan_id and p.user_id = auth.uid())
);
drop policy if exists "review_queue_select_own" on public.review_queue;
create policy "review_queue_select_own" on public.review_queue for select using (auth.uid() = user_id);

create or replace function public.enqueue_wrong_answer_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_correct then
    insert into public.review_queue(user_id, question_id, source_answer_id, due_at)
    values(new.user_id, new.question_id, new.id, new.answered_at + interval '1 day')
    on conflict(user_id, source_answer_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists enqueue_wrong_answer_review_trigger on public.user_answers;
create trigger enqueue_wrong_answer_review_trigger after insert on public.user_answers
for each row execute function public.enqueue_wrong_answer_review();

insert into public.review_queue(user_id, question_id, source_answer_id, due_at)
select user_id, question_id, id, answered_at + interval '1 day' from public.user_answers where not is_correct
on conflict(user_id, source_answer_id) do nothing;

create or replace function public.replace_weekly_study_plan(p_user_id uuid, p_week_start date, p_weekly_minutes integer, p_tasks jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan_id uuid;
begin
  if p_weekly_minutes < 60 or p_weekly_minutes > 2400 or jsonb_typeof(p_tasks) <> 'array'
    or jsonb_array_length(p_tasks) < 1 or jsonb_array_length(p_tasks) > 14 then raise exception 'invalid_plan'; end if;
  insert into public.study_plans(user_id, week_start, weekly_minutes)
  values(p_user_id, p_week_start, p_weekly_minutes)
  on conflict(user_id, week_start, model_version) do update set weekly_minutes=excluded.weekly_minutes,
    status='active', generated_at=now(), updated_at=now() returning id into v_plan_id;
  delete from public.plan_tasks where plan_id=v_plan_id;
  insert into public.plan_tasks(plan_id, topic_id, recommendation_id, task_type, scheduled_date, planned_minutes, display_order, reason)
  select v_plan_id, (item->>'topicId')::uuid,
    case when nullif(item->>'recommendationId','') is null then null else (item->>'recommendationId')::uuid end,
    item->>'taskType', (item->>'scheduledDate')::date, (item->>'plannedMinutes')::integer,
    (item->>'displayOrder')::smallint, item->>'reason' from jsonb_array_elements(p_tasks) item;
  return v_plan_id;
end $$;

create or replace function public.advance_review_item(p_user_id uuid, p_review_id uuid)
returns table(id uuid, status text, interval_step smallint, due_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_item public.review_queue%rowtype; v_days integer[] := array[1,7,15,30];
begin
  select * into v_item from public.review_queue where review_queue.id=p_review_id and user_id=p_user_id for update;
  if not found then raise exception 'review_not_available'; end if;
  if v_item.interval_step >= 4 then
    update public.review_queue set status='completed', last_reviewed_at=now(), updated_at=now()
    where review_queue.id=p_review_id returning review_queue.id, review_queue.status, review_queue.interval_step, review_queue.due_at
    into id,status,interval_step,due_at;
  else
    update public.review_queue set interval_step=v_item.interval_step+1,
      due_at=now() + make_interval(days => v_days[v_item.interval_step+1]), last_reviewed_at=now(), updated_at=now()
    where review_queue.id=p_review_id returning review_queue.id, review_queue.status, review_queue.interval_step, review_queue.due_at
    into id,status,interval_step,due_at;
  end if;
  return next;
end $$;

revoke all on function public.replace_weekly_study_plan(uuid,date,integer,jsonb) from public;
revoke all on function public.advance_review_item(uuid,uuid) from public;
grant execute on function public.replace_weekly_study_plan(uuid,date,integer,jsonb) to service_role;
grant execute on function public.advance_review_item(uuid,uuid) to service_role;
