-- Supabase onboarding schema (run in Supabase SQL editor)
-- Creates:
-- - public.profiles
-- - public.buyer_profiles
-- - public.user_preferences
-- With Row Level Security (RLS) so each user can only access their own rows.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text null,
  home_location_label text null,
  is_admin boolean not null default false,

  onboarding_completed_at timestamptz null,
  onboarding_step text not null default 'profile',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lightweight migration(s)
alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.buyer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  industries text[] not null default '{}'::text[],
  budget_min integer null,
  budget_max integer null,
  timeline text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  search_radius_km integer not null default 50,
  push_notifications_enabled boolean not null default false,
  email_notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.buyer_profiles enable row level security;
alter table public.user_preferences enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

-- Buyer profiles policies
drop policy if exists "buyer_profiles_select_own" on public.buyer_profiles;
create policy "buyer_profiles_select_own"
on public.buyer_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "buyer_profiles_insert_own" on public.buyer_profiles;
create policy "buyer_profiles_insert_own"
on public.buyer_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "buyer_profiles_update_own" on public.buyer_profiles;
create policy "buyer_profiles_update_own"
on public.buyer_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "buyer_profiles_delete_own" on public.buyer_profiles;
create policy "buyer_profiles_delete_own"
on public.buyer_profiles
for delete
to authenticated
using (auth.uid() = user_id);

-- Preferences policies
drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own"
on public.user_preferences
for delete
to authenticated
using (auth.uid() = user_id);

commit;

