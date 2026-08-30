-- Concede acesso administrativo ao proprietário da operação.
-- A promoção cobre o controle atual por perfil e a autorização legada por papéis.
alter table public.profiles add column if not exists account_role text not null default 'candidate'
  check (account_role in ('candidate','reviewer','admin'));

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','content_reviewer','support')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id);

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

grant select on public.profiles to authenticated;
grant select on public.user_roles to authenticated;

do $$
declare
  admin_user_id uuid;
  admin_full_name text;
begin
  select
    id,
    nullif(trim(coalesce(raw_user_meta_data->>'full_name', '')), '')
  into admin_user_id, admin_full_name
  from auth.users
  where lower(trim(email)) = 'digitalcarloscruz@gmail.com'
  order by id
  limit 1;

  if admin_user_id is null then
    raise exception 'admin_user_not_found: digitalcarloscruz@gmail.com';
  end if;

  insert into public.profiles (id, full_name, account_role)
  values (admin_user_id, coalesce(admin_full_name, 'Carlos Cruz'), 'admin')
  on conflict (id) do update set
    account_role = 'admin',
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.user_roles (user_id, role)
  values (admin_user_id, 'admin')
  on conflict (user_id, role) do nothing;
end
$$;

create or replace function public.is_account_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_role = 'admin'
  )
$$;

revoke all on function public.is_account_admin() from public;
grant execute on function public.is_account_admin() to authenticated, service_role;

grant select, insert, update, delete on public.pilot_cohorts to authenticated;
grant select, insert, update, delete on public.pilot_participants to authenticated;
grant select on public.pilot_feedback to authenticated;
grant select on public.pilot_events to authenticated;

drop policy if exists "pilot_cohorts_admin_all" on public.pilot_cohorts;
create policy "pilot_cohorts_admin_all" on public.pilot_cohorts
  for all to authenticated
  using (public.is_account_admin())
  with check (public.is_account_admin());

drop policy if exists "pilot_participants_admin_all" on public.pilot_participants;
create policy "pilot_participants_admin_all" on public.pilot_participants
  for all to authenticated
  using (public.is_account_admin())
  with check (public.is_account_admin());

drop policy if exists "pilot_feedback_admin_select" on public.pilot_feedback;
create policy "pilot_feedback_admin_select" on public.pilot_feedback
  for select to authenticated
  using (public.is_account_admin());

drop policy if exists "pilot_events_admin_select" on public.pilot_events;
create policy "pilot_events_admin_select" on public.pilot_events
  for select to authenticated
  using (public.is_account_admin());

-- O papel é lido pelas APIs para autorizar ações privilegiadas. Usuários
-- autenticados continuam podendo editar o perfil, exceto esta coluna.
revoke update on public.profiles from authenticated;
do $$
declare
  editable_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into editable_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name <> 'account_role';

  if editable_columns is not null then
    execute format('grant update (%s) on public.profiles to authenticated', editable_columns);
  end if;
end
$$;
