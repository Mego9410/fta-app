-- Migration: Set up hourly cron jobs for syncing web content and listings
-- Run this in Supabase SQL Editor
-- 
-- IMPORTANT: Replace these values before running:
-- 1. YOUR_PROJECT_REF - Your Supabase project reference ID
-- 2. YOUR_SERVICE_ROLE_KEY - Your Supabase service role key

begin;

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for making HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule hourly web content sync (runs at minute 0 of every hour)
-- This syncs articles and testimonials
SELECT cron.schedule(
  'sync-web-content-hourly',
  '0 * * * *', -- Every hour at minute 0 (cron format: minute hour day month weekday)
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-web-content',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule hourly listings sync (runs at minute 15 of every hour to stagger)
-- This syncs dental practice listings
SELECT cron.schedule(
  'sync-listings-hourly',
  '15 * * * *', -- Every hour at minute 15 (staggered to avoid conflicts)
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-listings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- View scheduled jobs (optional - to verify they're set up)
SELECT * FROM cron.job;

commit;
