-- Edital Engine: submissões privadas, extração auditável e revisão humana.
alter table public.profiles add column if not exists account_role text not null default 'candidate'
  check (account_role in ('candidate', 'reviewer', 'admin'));

create table if not exists public.notice_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  file_size integer not null check (file_size > 0 and file_size <= 15728640),
  file_hash text not null,
  page_count integer check (page_count > 0 and page_count <= 400),
  extracted_text text,
  structured_data jsonb not null default '{}'::jsonb,
  extraction_confidence numeric(4,3) check (extraction_confidence between 0 and 1),
  status text not null default 'uploaded'
    check (status in ('uploaded','extracting','needs_ocr','needs_review','validated','rejected','failed')),
  processing_error text,
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  validated_notice_id uuid references public.notices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

create index if not exists notice_submissions_user_date_idx
  on public.notice_submissions(user_id, created_at desc);
create index if not exists notice_submissions_review_queue_idx
  on public.notice_submissions(status, created_at)
  where status in ('needs_ocr','needs_review');

alter table public.notice_submissions enable row level security;

drop policy if exists "notice_submissions_select_own" on public.notice_submissions;
create policy "notice_submissions_select_own"
on public.notice_submissions for select
using (auth.uid() = user_id);

-- Uploads passam exclusivamente pela API server-side, que valida sessão,
-- assinatura, tamanho e conteúdo antes de usar a credencial administrativa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notice-submissions', 'notice-submissions', false, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
