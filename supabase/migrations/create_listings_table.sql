-- Migration: Create listings table synced from website
-- Run this in Supabase SQL Editor

begin;

-- Listings table (matches SQLite schema)
create table if not exists public.listings (
  id text primary key,
  status text not null check (status in ('active', 'archived')),
  featured integer not null default 0,

  tags_json jsonb not null default '[]'::jsonb,
  more_info_url text null,

  title text not null,
  industry text not null,
  summary text not null,

  location_city text not null,
  location_state text not null,
  latitude real null,
  longitude real null,

  asking_price integer not null,
  gross_revenue integer null,
  cash_flow integer null,
  ebitda integer null,

  year_established integer null,
  employees_range text null,

  freehold_value integer null,
  reconstituted_profit integer null,
  reconstituted_profit_percent real null,
  udas_count integer null,
  udas_price_per_uda integer null,
  company_type text null,
  detailed_information_text text null,

  confidential integer not null default 0,
  financing_available integer not null default 0,

  photos_json jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now() -- Last successful sync from website
);

-- Indexes for performance
create index if not exists idx_listings_status on public.listings (status);
create index if not exists idx_listings_featured on public.listings (featured desc);
create index if not exists idx_listings_updated_at on public.listings (updated_at desc);
create index if not exists idx_listings_synced_at on public.listings (synced_at desc);
create index if not exists idx_listings_location_state on public.listings (location_state);
create index if not exists idx_listings_industry on public.listings (industry);
create index if not exists idx_listings_asking_price on public.listings (asking_price);

-- Enable Row Level Security
alter table public.listings enable row level security;

-- Public read access (no authentication required)
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
on public.listings
for select
to public
using (true);

-- Service role can insert/update/delete (for sync function)
drop policy if exists "listings_service_role_all" on public.listings;
create policy "listings_service_role_all"
on public.listings
for all
to service_role
using (true)
with check (true);

commit;
