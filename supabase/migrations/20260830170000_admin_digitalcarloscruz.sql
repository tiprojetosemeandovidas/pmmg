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
