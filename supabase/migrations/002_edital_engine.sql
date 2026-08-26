-- Rota V2 / Fase 2: Edital Engine.
-- Execute após 001_multi_exam_foundation.sql.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  file_name text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  content_sha256 char(64) not null,
  storage_bucket text not null default 'editais-private',
  storage_path text not null unique,
  status text not null default 'uploaded' check (status in ('uploaded', 'queued', 'extracting', 'processing', 'normalizing', 'completed', 'needs_review', 'failed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  extraction_method text check (extraction_method in ('model_pdf', 'model_pdf_vision', 'manual')),
  extracted_data jsonb,
  extraction_confidence numeric(5,4) check (extraction_confidence is null or extraction_confidence between 0 and 1),
  validation_errors jsonb not null default '[]'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_sha256)
);

-- Mantém a migração reaplicável caso uma versão anterior da Fase 2 já tenha
-- criado `notices` com um conjunto menor de estados.
alter table public.notices add column if not exists review_status text not null default 'pending';
alter table public.notices drop constraint if exists notices_status_check;
update public.notices
set review_status = case when status = 'approved' then 'approved' when status = 'rejected' then 'rejected' else review_status end,
    status = case when status = 'extracted' then 'needs_review' when status in ('approved', 'rejected') then 'completed' else status end
where status in ('extracted', 'approved', 'rejected');
alter table public.notices add constraint notices_status_check check (status in ('uploaded', 'queued', 'extracting', 'processing', 'normalizing', 'completed', 'needs_review', 'failed'));
alter table public.notices drop constraint if exists notices_review_status_check;
alter table public.notices add constraint notices_review_status_check check (review_status in ('pending', 'approved', 'rejected'));

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'content_reviewer', 'support')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists notices_user_created_idx on public.notices(user_id, created_at desc);
create index if not exists notices_exam_idx on public.notices(exam_id) where exam_id is not null;

create table if not exists public.notice_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  provider_request_id text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.notice_extraction_runs drop constraint if exists notice_extraction_runs_status_check;
update public.notice_extraction_runs set status = 'queued' where status = 'started';
alter table public.notice_extraction_runs add constraint notice_extraction_runs_status_check check (status in ('queued', 'processing', 'completed', 'failed'));

create index if not exists notice_runs_notice_idx on public.notice_extraction_runs(notice_id, started_at desc);

create table if not exists public.notice_stages (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  name text not null,
  stage_type text not null default 'other',
  display_order integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notice_chunks (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  page_start integer check (page_start is null or page_start > 0),
  page_end integer check (page_end is null or page_end > 0),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  extraction_method text not null check (extraction_method in ('pdf_text', 'ocr', 'model')),
  created_at timestamptz not null default now(),
  unique (notice_id, chunk_index)
);

create table if not exists public.notice_topic_mappings (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  extracted_subject text not null,
  extracted_topic text not null,
  topic_id uuid references public.topics(id) on delete set null,
  match_method text not null check (match_method in ('stable_code', 'exact_name', 'alias', 'unmatched')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  unique (notice_id, extracted_subject, extracted_topic)
);

create index if not exists notice_topic_mappings_notice_idx on public.notice_topic_mappings(notice_id);
create index if not exists notice_topic_mappings_topic_idx on public.notice_topic_mappings(topic_id) where topic_id is not null;

create table if not exists public.api_rate_limits (
  key_hash char(64) primary key,
  hit_count integer not null check (hit_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_rate_limit(p_key_hash char(64), p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_reset timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  insert into public.api_rate_limits as limits (key_hash, hit_count, reset_at, updated_at)
  values (p_key_hash, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (key_hash) do update
  set hit_count = case when limits.reset_at <= now() then 1 else limits.hit_count + 1 end,
      reset_at = case when limits.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else limits.reset_at end,
      updated_at = now()
  returning hit_count, reset_at into current_count, current_reset;

  return query select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    greatest(ceil(extract(epoch from (current_reset - now())))::integer, 0);
end;
$$;

revoke all on function public.consume_rate_limit(char, integer, integer) from public;
grant execute on function public.consume_rate_limit(char, integer, integer) to service_role;

alter table public.notices enable row level security;
alter table public.user_roles enable row level security;
alter table public.notice_extraction_runs enable row level security;
alter table public.notice_stages enable row level security;
alter table public.notice_chunks enable row level security;
alter table public.notice_topic_mappings enable row level security;
alter table public.api_rate_limits enable row level security;

drop policy if exists "notices_select_own" on public.notices;
create policy "notices_select_own" on public.notices for select using (auth.uid() = user_id);
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles for select using (auth.uid() = user_id);
drop policy if exists "notice_runs_select_own" on public.notice_extraction_runs;
create policy "notice_runs_select_own" on public.notice_extraction_runs for select using (auth.uid() = user_id);
drop policy if exists "notice_stages_select_own" on public.notice_stages;
create policy "notice_stages_select_own" on public.notice_stages for select using (
  exists (select 1 from public.notices n where n.id = notice_id and n.user_id = auth.uid())
);
drop policy if exists "notice_chunks_select_own" on public.notice_chunks;
create policy "notice_chunks_select_own" on public.notice_chunks for select using (
  exists (select 1 from public.notices n where n.id = notice_id and n.user_id = auth.uid())
);
drop policy if exists "notice_topic_mappings_select_own" on public.notice_topic_mappings;
create policy "notice_topic_mappings_select_own" on public.notice_topic_mappings for select using (
  exists (select 1 from public.notices n where n.id = notice_id and n.user_id = auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editais-private', 'editais-private', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.notices is 'Editais privados enviados pelo candidato; extrações exigem validação e revisão antes de aprovação.';
