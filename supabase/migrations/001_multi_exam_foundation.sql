-- Rota V2 / Fase 1: fundação multi-concurso e taxonomia universal.
-- Execute depois de supabase/schema.sql. Migração aditiva e idempotente.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text,
  country_code char(2) not null default 'BR',
  state_code char(2),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_identity_idx
  on public.organizations (lower(name), country_code, coalesce(state_code, ''));

create table if not exists public.exam_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exam_boards_name_idx on public.exam_boards (lower(name));

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  career_area text,
  education_level text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists positions_identity_idx
  on public.positions (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  stable_code text not null unique check (stable_code ~ '^[A-Z0-9_]+(?:\.[A-Z0-9_]+)*$'),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  parent_id uuid references public.topics(id) on delete restrict,
  stable_code text not null unique check (stable_code ~ '^[A-Z0-9_]+(?:\.[A-Z0-9_]+)*$'),
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  depth smallint not null default 0 check (depth between 0 and 12),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id),
  unique (subject_id, slug)
);

create index if not exists topics_subject_idx on public.topics(subject_id);
create index if not exists topics_parent_idx on public.topics(parent_id);

create table if not exists public.topic_aliases (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'manual' check (source in ('manual', 'notice', 'question', 'ai_suggested')),
  created_at timestamptz not null default now(),
  unique (topic_id, normalized_alias)
);

create index if not exists topic_aliases_lookup_idx on public.topic_aliases(normalized_alias);

create table if not exists public.topic_relations (
  source_topic_id uuid not null references public.topics(id) on delete cascade,
  target_topic_id uuid not null references public.topics(id) on delete cascade,
  relation_type text not null check (relation_type in ('broader', 'narrower', 'related', 'prerequisite', 'equivalent')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (source_topic_id, target_topic_id, relation_type),
  check (source_topic_id <> target_topic_id)
);

-- `exams` já armazena provas históricas. As novas colunas dão identidade de
-- concurso/ciclo sem quebrar o catálogo e serão obrigatórias após o backfill.
alter table public.exams add column if not exists slug text;
alter table public.exams add column if not exists title text;
alter table public.exams add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.exams add column if not exists position_id uuid references public.positions(id) on delete restrict;
alter table public.exams add column if not exists exam_board_id uuid references public.exam_boards(id) on delete set null;
alter table public.exams add column if not exists application_opens_at timestamptz;
alter table public.exams add column if not exists application_closes_at timestamptz;
alter table public.exams add column if not exists exam_date date;
alter table public.exams add column if not exists vacancies integer check (vacancies is null or vacancies >= 0);
alter table public.exams add column if not exists has_physical_test boolean not null default false;
alter table public.exams add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.exams add column if not exists updated_at timestamptz not null default now();

create unique index if not exists exams_slug_unique_idx on public.exams(slug) where slug is not null;
create index if not exists exams_organization_idx on public.exams(organization_id);
create index if not exists exams_position_idx on public.exams(position_id);

create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  display_name text,
  question_count integer check (question_count is null or question_count >= 0),
  weight numeric(8,3) check (weight is null or weight >= 0),
  minimum_score numeric(8,3) check (minimum_score is null or minimum_score >= 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, subject_id)
);

create table if not exists public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete restrict,
  exam_subject_id uuid references public.exam_subjects(id) on delete cascade,
  weight numeric(8,3) check (weight is null or weight >= 0),
  historical_frequency numeric(5,4) check (historical_frequency is null or historical_frequency between 0 and 1),
  source_reference text,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, topic_id)
);

create index if not exists exam_topics_topic_idx on public.exam_topics(topic_id);

create table if not exists public.user_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  priority smallint not null default 1 check (priority between 1 and 100),
  status text not null default 'observing' check (status in ('primary', 'secondary', 'observing', 'archived')),
  target_exam_date date,
  started_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exam_id),
  check ((status = 'archived' and archived_at is not null) or status <> 'archived')
);

create unique index if not exists user_exams_one_primary_idx
  on public.user_exams(user_id) where status = 'primary';
create index if not exists user_exams_user_status_idx on public.user_exams(user_id, status);

-- Uma raiz de conhecimento por usuário e tópico, deliberadamente sem exam_id.
create table if not exists public.topic_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  questions_answered integer not null default 0 check (questions_answered >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  wrong_answers integer not null default 0 check (wrong_answers >= 0),
  last_studied_at timestamptz,
  last_reviewed_at timestamptz,
  last_question_at timestamptz,
  average_response_time_seconds numeric(10,2) check (average_response_time_seconds is null or average_response_time_seconds >= 0),
  streak integer not null default 0,
  model_version text not null default 'v1',
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id),
  check (correct_answers + wrong_answers <= questions_answered)
);

create index if not exists topic_mastery_topic_idx on public.topic_mastery(topic_id);

-- Backfill conservador do catálogo PMMG existente.
insert into public.organizations (name, acronym, country_code, state_code, slug)
values ('Polícia Militar de Minas Gerais', 'PMMG', 'BR', 'MG', 'pmmg')
on conflict (slug) do nothing;

insert into public.positions (organization_id, name, slug, career_area)
select o.id, v.name, v.slug, 'seguranca-publica'
from public.organizations o
cross join (values ('Soldado', 'soldado'), ('Cadete', 'cadete')) as v(name, slug)
where o.slug = 'pmmg'
on conflict do nothing;

update public.exams e
set organization_id = o.id,
    slug = coalesce(e.slug, concat('pmmg-', lower(e.role), '-', e.exam_year)),
    title = coalesce(e.title, concat('PMMG ', e.role, ' ', e.exam_year)),
    has_physical_test = true
from public.organizations o
where o.slug = 'pmmg'
  and upper(e.institution) = 'PMMG';

update public.exams e
set position_id = p.id
from public.positions p
where e.organization_id = p.organization_id
  and p.slug = case when lower(e.role) = 'cfsd' then 'soldado' when lower(e.role) = 'cfo' then 'cadete' end
  and e.position_id is null;

insert into public.exam_boards (name, slug)
select distinct trim(e.organizer), lower(regexp_replace(trim(e.organizer), '[^a-zA-Z0-9]+', '-', 'g'))
from public.exams e
where nullif(trim(e.organizer), '') is not null
on conflict do nothing;

update public.exams e
set exam_board_id = b.id
from public.exam_boards b
where e.exam_board_id is null and lower(b.name) = lower(e.organizer);

-- Catálogo publicado pode ser lido sem expor dados do candidato.
alter table public.organizations enable row level security;
alter table public.exam_boards enable row level security;
alter table public.positions enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.topic_aliases enable row level security;
alter table public.topic_relations enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.exam_topics enable row level security;
alter table public.user_exams enable row level security;
alter table public.topic_mastery enable row level security;

drop policy if exists "catalog_organizations_read" on public.organizations;
create policy "catalog_organizations_read" on public.organizations for select using (active);
drop policy if exists "catalog_boards_read" on public.exam_boards;
create policy "catalog_boards_read" on public.exam_boards for select using (active);
drop policy if exists "catalog_positions_read" on public.positions;
create policy "catalog_positions_read" on public.positions for select using (active);
drop policy if exists "catalog_subjects_read" on public.subjects;
create policy "catalog_subjects_read" on public.subjects for select using (active);
drop policy if exists "catalog_topics_read" on public.topics;
create policy "catalog_topics_read" on public.topics for select using (active);
drop policy if exists "catalog_topic_aliases_read" on public.topic_aliases;
create policy "catalog_topic_aliases_read" on public.topic_aliases for select using (true);
drop policy if exists "catalog_topic_relations_read" on public.topic_relations;
create policy "catalog_topic_relations_read" on public.topic_relations for select using (true);
drop policy if exists "published_exam_subjects_read" on public.exam_subjects;
create policy "published_exam_subjects_read" on public.exam_subjects for select using (
  exists (select 1 from public.exams e where e.id = exam_id and e.status = 'published')
);
drop policy if exists "published_exam_topics_read" on public.exam_topics;
create policy "published_exam_topics_read" on public.exam_topics for select using (
  exists (select 1 from public.exams e where e.id = exam_id and e.status = 'published')
);

drop policy if exists "user_exams_select_own" on public.user_exams;
create policy "user_exams_select_own" on public.user_exams for select using (auth.uid() = user_id);
drop policy if exists "user_exams_insert_own" on public.user_exams;
create policy "user_exams_insert_own" on public.user_exams for insert with check (auth.uid() = user_id);
drop policy if exists "user_exams_update_own" on public.user_exams;
create policy "user_exams_update_own" on public.user_exams for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_exams_delete_own" on public.user_exams;
create policy "user_exams_delete_own" on public.user_exams for delete using (auth.uid() = user_id);

drop policy if exists "topic_mastery_select_own" on public.topic_mastery;
create policy "topic_mastery_select_own" on public.topic_mastery for select using (auth.uid() = user_id);

comment on table public.topic_mastery is 'Perfil universal de conhecimento do candidato; nunca deve conter exam_id.';
comment on column public.topics.stable_code is 'Identificador estável e independente do nome exibido, por exemplo CONST.DIREITOS_FUNDAMENTAIS.ART5.';
