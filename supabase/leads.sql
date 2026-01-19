-- Supabase leads schema (run in Supabase SQL editor)
-- Creates:
-- - public.leads
-- With Row Level Security (RLS):
-- - Anyone (anon/authenticated) can insert leads (so enquiries work without login)
-- - Only admins (profiles.is_admin) can read/update/delete

begin;

create table if not exists public.leads (
  id text primary key,
  type text not null check (type in ('buyerInquiry', 'sellerIntake')),
  listing_id text null,
  user_id uuid null references public.profiles (id) on delete set null,

  name text not null,
  email text null,
  phone text null,
  callback_window text null,
  message text null,

  industry text null,
  location text null,
  income_mix text null,
  practice_type text null,
  surgeries_count integer null,
  tenure text null,
  readiness text null,
  timeline text null,
  revenue_range text null,
  earnings_range text null,

  created_at timestamptz not null default now()
);

create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_type on public.leads (type);
create index if not exists idx_leads_user_id on public.leads (user_id);
create index if not exists idx_leads_listing_id on public.leads (listing_id);

alter table public.leads enable row level security;

-- Anyone can submit a lead. If authenticated, user_id must either be null or match auth.uid().
drop policy if exists "leads_insert_any" on public.leads;
create policy "leads_insert_any"
on public.leads
for insert
to anon, authenticated
with check (
  (auth.uid() is null and user_id is null)
  or
  (auth.uid() is not null and (user_id is null or user_id = auth.uid()))
);

-- Admin predicate: allow access only if the current user is flagged as admin in profiles.
drop policy if exists "leads_select_admin" on public.leads;
create policy "leads_select_admin"
on public.leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "leads_update_admin" on public.leads;
create policy "leads_update_admin"
on public.leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin"
on public.leads
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

commit;

