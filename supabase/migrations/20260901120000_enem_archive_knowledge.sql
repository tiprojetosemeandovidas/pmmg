-- Acervo histórico ENEM (1998-2025): documentos, texto pesquisável e itens extraídos.
-- O conteúdo fica privado e só é acessado pelas APIs server-side de curadoria.

insert into public.exams (
  institution, state, role, exam_year, organizer, source_url,
  authorization_reference, status, slug, title, metadata
)
select
  'INEP', 'DF', 'ENEM', year, 'Inep',
  'https://riep.inep.gov.br/',
  'Caderno da aplicação regular e gabarito registrados no Repositório Institucional do Inep',
  'published', concat('enem-', year, '-regular-amarelo'),
  concat('ENEM ', year, ' — aplicação regular'),
  jsonb_build_object('officialQuestions', true, 'edition', 'regular', 'bookletColor', 'amarelo')
from generate_series(1998, 2025) as year
on conflict (institution, state, role, exam_year, organizer) do update set
  slug = excluded.slug,
  title = excluded.title,
  source_url = excluded.source_url,
  authorization_reference = excluded.authorization_reference,
  status = 'published',
  metadata = excluded.metadata;

create table if not exists public.enem_archive_documents (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  exam_year integer not null check (exam_year between 1998 and 2100),
  exam_day smallint not null check (exam_day in (1, 2)),
  document_type text not null check (document_type in ('exam', 'answer_key', 'exam_with_answer_key')),
  edition text not null default 'regular',
  booklet_color text not null default 'amarelo',
  file_name text not null,
  relative_path text not null,
  official_page_url text,
  official_download_url text,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer not null check (page_count > 0),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'extracted', 'partial', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sha256),
  unique (exam_year, relative_path)
);

create table if not exists public.enem_archive_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.enem_archive_documents(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(trim(content)) > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  token_estimate integer not null check (token_estimate > 0),
  search_document tsvector generated always as (to_tsvector('portuguese', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, page_number, chunk_index),
  unique (document_id, content_hash)
);

create table if not exists public.enem_archive_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  source_document_id uuid not null references public.enem_archive_documents(id) on delete restrict,
  answer_key_document_id uuid references public.enem_archive_documents(id) on delete set null,
  exam_year integer not null check (exam_year between 1998 and 2100),
  exam_day smallint not null check (exam_day in (1, 2)),
  item_number integer not null check (item_number between 1 and 200),
  language_variant text not null default 'common'
    check (language_variant in ('common', 'english', 'spanish')),
  axis text not null check (axis in ('Linguagens', 'Matemática', 'Ciências Humanas', 'Ciências da Natureza', 'Interdisciplinar')),
  source_page integer not null check (source_page > 0),
  statement text not null check (length(trim(statement)) > 0),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 5),
  correct_option smallint check (correct_option between 0 and 4),
  raw_text text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  extraction_confidence numeric(4,3) not null check (extraction_confidence between 0 and 1),
  extraction_status text not null default 'needs_review'
    check (extraction_status in ('ready', 'needs_review', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  search_document tsvector generated always as (
    to_tsvector('portuguese', statement || ' ' || coalesce(options::text, '') || ' ' || axis)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_year, exam_day, item_number, language_variant),
  unique (content_hash)
);

create index if not exists enem_archive_documents_year_idx
  on public.enem_archive_documents(exam_year, exam_day, document_type);
create index if not exists enem_archive_chunks_search_idx
  on public.enem_archive_chunks using gin(search_document);
create index if not exists enem_archive_items_search_idx
  on public.enem_archive_items using gin(search_document);
create index if not exists enem_archive_items_filter_idx
  on public.enem_archive_items(axis, exam_year desc, extraction_status);

alter table public.enem_archive_documents enable row level security;
alter table public.enem_archive_chunks enable row level security;
alter table public.enem_archive_items enable row level security;

comment on table public.enem_archive_documents is 'Inventário auditável dos PDFs históricos do ENEM fornecidos ao projeto.';
comment on table public.enem_archive_chunks is 'Texto extraído por página para recuperação de contexto, sem acesso público direto.';
comment on table public.enem_archive_items is 'Itens oficiais extraídos automaticamente; ready indica qualidade técnica da extração, não revisão editorial.';
