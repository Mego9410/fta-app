-- Migration: Create tables for articles and testimonials synced from website
-- Run this in Supabase SQL Editor

begin;

-- Articles table
create table if not exists public.articles (
  id text primary key, -- URL-based ID (slug or full URL hash)
  title text not null,
  url text not null unique,
  date_text text null,
  excerpt text null,
  content_text text not null,
  blocks_json jsonb null, -- Structured article blocks for rich rendering
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now() -- Last successful sync from website
);

-- Testimonials table
create table if not exists public.testimonials (
  id text primary key, -- Generated ID based on author+quote hash
  author text not null,
  quote text not null,
  date_text text null,
  url text null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now() -- Last successful sync from website
);

-- Indexes for performance
create index if not exists idx_articles_url on public.articles (url);
create index if not exists idx_articles_updated_at on public.articles (updated_at desc);
create index if not exists idx_articles_synced_at on public.articles (synced_at desc);

create index if not exists idx_testimonials_author on public.testimonials (author);
create index if not exists idx_testimonials_updated_at on public.testimonials (updated_at desc);
create index if not exists idx_testimonials_synced_at on public.testimonials (synced_at desc);

-- Enable Row Level Security
alter table public.articles enable row level security;
alter table public.testimonials enable row level security;

-- Public read access (no authentication required)
drop policy if exists "articles_select_public" on public.articles;
create policy "articles_select_public"
on public.articles
for select
to public
using (true);

drop policy if exists "testimonials_select_public" on public.testimonials;
create policy "testimonials_select_public"
on public.testimonials
for select
to public
using (true);

-- Service role can insert/update/delete (for sync function)
drop policy if exists "articles_service_role_all" on public.articles;
create policy "articles_service_role_all"
on public.articles
for all
to service_role
using (true)
with check (true);

drop policy if exists "testimonials_service_role_all" on public.testimonials;
create policy "testimonials_service_role_all"
on public.testimonials
for all
to service_role
using (true)
with check (true);

commit;
