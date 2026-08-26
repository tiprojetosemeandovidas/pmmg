-- Rota V2 / Fase 3: Question Engine.
-- Execute após 002_edital_engine.sql. Migração aditiva e idempotente.

alter table public.questions add column if not exists source_type text;
alter table public.questions add column if not exists validation_status text not null default 'pending';
alter table public.questions add column if not exists validation_notes text;
alter table public.questions add column if not exists validated_by uuid references auth.users(id) on delete set null;
alter table public.questions add column if not exists validated_at timestamptz;
alter table public.questions add column if not exists updated_at timestamptz not null default now();
alter table public.questions add column if not exists search_document tsvector
  generated always as (to_tsvector('portuguese', coalesce(statement, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(topic, ''))) stored;

update public.questions
set source_type = case when source_type is null then 'official_exam' else source_type end,
    validation_status = case
      when status = 'published' and correct_option is not null and reviewed_by is not null then 'validated'
      when status = 'rejected' then 'rejected'
      else validation_status
    end,
    validated_by = case when status = 'published' and correct_option is not null then reviewed_by else validated_by end,
    validated_at = case when status = 'published' and correct_option is not null and reviewed_by is not null then coalesce(reviewed_at, now()) else validated_at end
where source_type is null
   or (status = 'published' and correct_option is not null and reviewed_by is not null and validation_status = 'pending')
   or (status = 'rejected' and validation_status <> 'rejected');

alter table public.questions alter column source_type set default 'manually_created';
alter table public.questions alter column source_type set not null;
alter table public.questions drop constraint if exists questions_source_type_check;
alter table public.questions add constraint questions_source_type_check
  check (source_type in ('official_exam', 'licensed', 'public_source', 'ai_generated', 'manually_created'));
alter table public.questions drop constraint if exists questions_validation_status_check;
alter table public.questions add constraint questions_validation_status_check
  check (validation_status in ('pending', 'validated', 'rejected'));
alter table public.questions drop constraint if exists questions_validation_consistency_check;
alter table public.questions add constraint questions_validation_consistency_check check (
  validation_status <> 'validated'
  or (correct_option is not null and validated_by is not null and validated_at is not null)
);

create index if not exists questions_validation_idx on public.questions(validation_status, status);
create index if not exists questions_source_type_idx on public.questions(source_type);
create index if not exists questions_search_idx on public.questions using gin(search_document);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 25),
  label text not null check (label ~ '^[A-Z]$'),
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, option_index),
  unique (question_id, label)
);

create table if not exists public.question_topics (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete restrict,
  relevance numeric(5,4) not null default 1 check (relevance between 0 and 1),
  is_primary boolean not null default false,
  classification_method text not null default 'manual'
    check (classification_method in ('manual', 'stable_code', 'exact_name', 'alias', 'ai_suggested')),
  classified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (question_id, topic_id)
);

create unique index if not exists question_topics_one_primary_idx
  on public.question_topics(question_id) where is_primary;
create index if not exists question_topics_topic_idx on public.question_topics(topic_id, relevance desc);

create table if not exists public.question_sources (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  source_type text not null
    check (source_type in ('official_exam', 'licensed', 'public_source', 'ai_generated', 'manually_created')),
  source_name text not null,
  source_url text,
  authorization_reference text,
  source_page integer check (source_page is null or source_page > 0),
  official boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (question_id, source_type, source_name)
);

-- Normaliza o JSON legado sem removê-lo; `questions.options` permanece para
-- compatibilidade até os consumidores antigos migrarem completamente.
insert into public.question_options (question_id, option_index, label, content)
select q.id, (option.ordinality - 1)::smallint,
       chr(64 + option.ordinality::integer), option.value
from public.questions q
cross join lateral jsonb_array_elements_text(q.options) with ordinality as option(value, ordinality)
on conflict (question_id, option_index) do update
set label = excluded.label, content = excluded.content, updated_at = now();

insert into public.question_sources (
  question_id, source_type, source_name, source_url,
  authorization_reference, source_page, official
)
select q.id, q.source_type,
       coalesce(nullif(e.title, ''), concat(e.institution, ' ', e.role, ' ', e.exam_year)),
       e.source_url, e.authorization_reference, q.source_page,
       q.source_type = 'official_exam'
from public.questions q
join public.exams e on e.id = q.exam_id
on conflict (question_id, source_type, source_name) do update
set source_url = excluded.source_url,
    authorization_reference = excluded.authorization_reference,
    source_page = excluded.source_page,
    official = excluded.official;

-- Backfill conservador: associa somente nomes exatos e deixa ambiguidades sem vínculo.
insert into public.question_topics (question_id, topic_id, is_primary, classification_method)
select q.id, (array_agg(t.id order by t.id))[1], true, 'exact_name'
from public.questions q
join public.topics t on lower(trim(t.name)) = lower(trim(q.topic))
where nullif(trim(q.topic), '') is not null
group by q.id
having count(*) = 1
on conflict (question_id, topic_id) do nothing;

alter table public.question_options enable row level security;
alter table public.question_topics enable row level security;
alter table public.question_sources enable row level security;

drop policy if exists "published_question_options_read" on public.question_options;
create policy "published_question_options_read" on public.question_options for select using (
  exists (select 1 from public.questions q where q.id = question_id and q.status = 'published' and q.validation_status = 'validated')
);
drop policy if exists "published_question_topics_read" on public.question_topics;
create policy "published_question_topics_read" on public.question_topics for select using (
  exists (select 1 from public.questions q where q.id = question_id and q.status = 'published' and q.validation_status = 'validated')
);
drop policy if exists "published_question_sources_read" on public.question_sources;
create policy "published_question_sources_read" on public.question_sources for select using (
  exists (select 1 from public.questions q where q.id = question_id and q.status = 'published' and q.validation_status = 'validated')
);

drop policy if exists "published_questions_read_authenticated" on public.questions;
create policy "published_questions_read_authenticated" on public.questions for select to authenticated using (
  status = 'published' and validation_status = 'validated'
);

comment on column public.questions.source_type is 'Origem explícita; conteúdo de IA nunca deve ser apresentado como oficial.';
comment on table public.question_topics is 'Relação muitos-para-muitos entre questões e a taxonomia universal.';
