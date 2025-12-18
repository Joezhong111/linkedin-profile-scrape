-- RBAC & quotas schema (idempotent)

-- user_roles: admin/user
create table if not exists public.user_roles (
  user_id uuid primary key,
  role text not null check (role in ('admin','user')) default 'user',
  created_at timestamptz default now()
);

-- app_settings: global toggles
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  registration_open boolean not null default true,
  google_oauth_open boolean not null default true,
  updated_at timestamptz default now()
);

-- apify_quotas: daily limit per user
create table if not exists public.apify_quotas (
  user_id uuid primary key,
  daily_limit int not null default 0,
  updated_at timestamptz default now()
);

-- apify_usage: daily usage per user
create table if not exists public.apify_usage (
  user_id uuid not null,
  day date not null,
  used_count int not null default 0,
  updated_at timestamptz default now(),
  unique (user_id, day)
);

-- helper: is_admin(uid)
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = 'admin'
  );
$$;

-- seed fixed admin
insert into public.user_roles (user_id, role)
values ('67a7094d-5445-4ce4-bfd9-76265195d396','admin')
on conflict (user_id) do update set role = excluded.role;

-- Enable RLS
alter table public.user_roles enable row level security;
alter table public.app_settings enable row level security;
alter table public.apify_quotas enable row level security;
alter table public.apify_usage enable row level security;

-- Policies: user_roles
-- read: admin can read; (optional) user read own
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='ur_select'
  ) then
    create policy ur_select on public.user_roles for select
    using (public.is_admin(auth.uid()) or user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='ur_write'
  ) then
    create policy ur_write on public.user_roles for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- Policies: app_settings (admin only)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_settings' and policyname='as_all'
  ) then
    create policy as_all on public.app_settings for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- Policies: apify_quotas
-- read: admin or own; write: admin only (or relax to own if desired)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='apify_quotas' and policyname='aq_select'
  ) then
    create policy aq_select on public.apify_quotas for select
    using (public.is_admin(auth.uid()) or user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='apify_quotas' and policyname='aq_write'
  ) then
    create policy aq_write on public.apify_quotas for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- Policies: apify_usage
-- read: admin or own; write: admin or own (so server using user token can upsert)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='apify_usage' and policyname='au_select'
  ) then
    create policy au_select on public.apify_usage for select
    using (public.is_admin(auth.uid()) or user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='apify_usage' and policyname='au_write'
  ) then
    create policy au_write on public.apify_usage for all
    using (public.is_admin(auth.uid()) or user_id = auth.uid())
    with check (public.is_admin(auth.uid()) or user_id = auth.uid());
  end if;
end $$;

