-- Migration: Add detailed_information_text column to listings table
-- Run this in Supabase SQL Editor

begin;

alter table public.listings
add column if not exists detailed_information_text text null;

commit;
