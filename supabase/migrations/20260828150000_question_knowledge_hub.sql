-- Central de conhecimento: proveniência manual/web, lotes e revisão humana.
alter table public.questions drop constraint if exists questions_source_type_check;
alter table public.questions add constraint questions_source_type_check
  check (source_type in ('official_exam','licensed','public_source','ai_generated','manually_created','web_researched'));
alter table public.questions add column if not exists ingestion_origin text not null default 'legacy'
  check (ingestion_origin in ('legacy','manual','file_import','web_researched'));
alter table public.questions add column if not exists generation_model text;
alter table public.questions add column if not exists provenance jsonb not null default '{}'::jsonb;

create table if not exists public.question_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  origin text not null check (origin in ('manual','file_import','web_researched')),
  provider text,
  model text,
  query text,
  search_filters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','searching','needs_review','completed','failed')),
  source_count integer not null default 0 check (source_count >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.question_import_batches(id) on delete cascade,
  origin text not null check (origin in ('manual','file_import','web_researched')),
  provider text,
  title text not null,
  url text,
  publisher text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  excerpt text,
  rights_status text not null default 'unknown' check (rights_status in ('unknown','official','public_domain','authorized','restricted')),
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists content_sources_batch_url_idx
  on public.content_sources(batch_id, url) where url is not null;
create index if not exists content_sources_batch_idx on public.content_sources(batch_id, created_at);

create table if not exists public.question_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.question_import_batches(id) on delete cascade,
  origin text not null check (origin in ('manual','file_import','web_researched')),
  exam_id uuid references public.exams(id) on delete set null,
  axis_id uuid references public.question_axes(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  subject text not null,
  topic text,
  statement text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5),
  correct_option integer not null check (correct_option between 0 and 4),
  explanation text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  content_hash text not null unique,
  generation_model text,
  prompt_version text,
  provenance jsonb not null default '{}'::jsonb,
  status text not null default 'needs_review' check (status in ('needs_review','approved','rejected','duplicate')),
  published_question_id uuid references public.questions(id) on delete set null,
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_candidate_sources (
  candidate_id uuid not null references public.question_candidates(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  relation text not null default 'research_context' check (relation in ('research_context','direct_support','original_question')),
  primary key (candidate_id, source_id)
);

create table if not exists public.question_source_links (
  question_id uuid not null references public.questions(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete restrict,
  relation text not null default 'research_context' check (relation in ('research_context','direct_support','original_question')),
  primary key (question_id, source_id)
);

create index if not exists question_candidates_review_idx on public.question_candidates(status, created_at);
create index if not exists question_import_batches_status_idx on public.question_import_batches(status, created_at desc);

alter table public.question_import_batches enable row level security;
alter table public.content_sources enable row level security;
alter table public.question_candidates enable row level security;
alter table public.question_candidate_sources enable row level security;
alter table public.question_source_links enable row level security;

-- Sem políticas públicas: toda escrita e toda curadoria passam pela API server-side.
-- Alunos continuam lendo apenas questions com status published pela política existente.

insert into public.question_axes (name, slug, display_order) values
  ('Redação','redacao',60),('Matemática','matematica',70),
  ('Ciências Humanas','ciencias-humanas',80),('Ciências da Natureza','ciencias-da-natureza',90)
on conflict (slug) do update set name = excluded.name, display_order = excluded.display_order;
