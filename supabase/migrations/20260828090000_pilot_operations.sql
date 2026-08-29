-- Operação do piloto: planos internos, consumo e observabilidade sem gateway acoplado.
create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  entitlements jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code) on delete restrict,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','expired')),
  provider text not null default 'internal',
  external_customer_id text,
  external_subscription_id text,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscriptions_one_current_idx
  on public.user_subscriptions(user_id) where status in ('trialing','active');

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('mentor_request','notice_upload')),
  quantity integer not null default 1 check (quantity > 0),
  request_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, metric, request_id)
);

create table if not exists public.operational_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  route text not null,
  event_type text not null,
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_metric_date_idx on public.usage_events(user_id, metric, created_at desc);
create index if not exists operational_events_route_date_idx on public.operational_events(route, created_at desc);
create index if not exists operational_events_status_date_idx on public.operational_events(status_code, created_at desc);

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.operational_events enable row level security;

drop policy if exists "subscription_plans_read" on public.subscription_plans;
create policy "subscription_plans_read" on public.subscription_plans for select using (active);
drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own" on public.user_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events for select using (auth.uid() = user_id);

-- operational_events não tem política pública: leitura somente via API de admin.
insert into public.subscription_plans (code, name, price_cents, entitlements) values
  ('free','Gratuito',0,'{"mentorDailyRequests":5,"noticeMonthlyUploads":1,"noticeMaxBytes":10485760,"opportunityTracking":true,"physicalHistory":true}'::jsonb),
  ('pilot','Piloto',0,'{"mentorDailyRequests":30,"noticeMonthlyUploads":5,"noticeMaxBytes":15728640,"opportunityTracking":true,"physicalHistory":true}'::jsonb),
  ('pro','Rota Pro',2990,'{"mentorDailyRequests":100,"noticeMonthlyUploads":20,"noticeMaxBytes":15728640,"opportunityTracking":true,"physicalHistory":true}'::jsonb)
on conflict (code) do update set name = excluded.name, price_cents = excluded.price_cents, entitlements = excluded.entitlements, active = true, updated_at = now();
