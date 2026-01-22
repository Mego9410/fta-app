-- Migration: Add notified_at column to leads table for email idempotency + rate limiting
-- Run this in Supabase SQL Editor if your leads table doesn't have notified_at yet

begin;

alter table public.leads add column if not exists notified_at timestamptz null;

create index if not exists idx_leads_notified_at on public.leads (notified_at desc);

commit;
