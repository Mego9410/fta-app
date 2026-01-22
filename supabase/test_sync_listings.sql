-- Test script: Manually trigger sync-listings function
-- Run this in Supabase SQL Editor to test the sync

-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values
SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-listings',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) AS request_id;

-- After running, check the result:
-- If successful, you'll get a request_id
-- Then check the Edge Function logs and listings table
