# Production Setup Guide

This document covers the SQL migrations and environment variables needed to deploy the FTA app to production.

## 1. Supabase Database Migrations

### 1.1 Leads Table Migration

Run this SQL in your Supabase SQL Editor to add the `notified_at` column for abuse protection:

```sql
-- Add notified_at column for email idempotency + rate limiting
alter table public.leads add column if not exists notified_at timestamptz null;

-- Index for rate-limit queries
create index if not exists idx_leads_notified_at on public.leads (notified_at desc);
```

**Note:** If you're setting up from scratch, the full schema is in `supabase/leads.sql` (which includes this column). This migration is only needed if you already have a `leads` table without `notified_at`.

### 1.2 Web Content Tables Migration

Run the migration file `supabase/migrations/create_web_content_tables.sql` in your Supabase SQL Editor to create tables for articles and testimonials:

```bash
# Or copy-paste the contents of the file into Supabase SQL Editor
```

This creates:
- `public.articles` table - stores synced article content from the website
- `public.testimonials` table - stores synced testimonials from the website
- Public read access (no authentication required)
- Service role write access (for sync function)

### 1.3 Listings Table Migration

Run the migration file `supabase/migrations/create_listings_table.sql` in your Supabase SQL Editor to create the listings table:

```bash
# Or copy-paste the contents of the file into Supabase SQL Editor
```

This creates:
- `public.listings` table - stores synced listings from the website
- Public read access (no authentication required)
- Service role write access (for sync function)
- Indexes for performance (status, featured, location, industry, price)

## 2. Supabase Edge Functions

### 2.1 Deploy Edge Functions

Deploy the sync functions to Supabase:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the sync functions
supabase functions deploy sync-web-content
supabase functions deploy sync-listings
```

### 2.2 Edge Function Secrets

Set these secrets in your Supabase project dashboard (Settings → Edge Functions → Secrets):

#### Required for email functions (`inquiry-email` and `seller-intake-email`):

- **`RESEND_API_KEY`** - Your Resend API key for sending emails
- **`INQUIRY_FROM_EMAIL`** - Sender email address (must be verified in Resend)
- **`SUPABASE_URL`** - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **`SUPABASE_SERVICE_ROLE_KEY`** - Your Supabase service role key (for rate limiting checks)

#### Required for sync functions (`sync-web-content` and `sync-listings`):

- **`SUPABASE_URL`** - Your Supabase project URL (automatically available, but can be set explicitly)
- **`SUPABASE_SERVICE_ROLE_KEY`** - Your Supabase service role key (for writing to articles/testimonials/listings tables)

#### Optional:

- **`INQUIRY_TO_EMAIL`** - Override recipient email (defaults to `oliver.acton@ft-associates.com`)

**How to set secrets:**
1. Go to Supabase Dashboard → Your Project → Edge Functions
2. Click on a function (e.g., `sync-web-content`)
3. Go to "Secrets" tab
4. Add each secret name and value
5. Repeat for other functions

### 2.3 Schedule Sync Function (Recommended)

Set up an hourly cron job to sync web content. You can use:

**Option A: Supabase Cron (pg_cron extension)**
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly web content sync (runs at minute 0 of every hour)
SELECT cron.schedule(
  'sync-web-content-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-web-content',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule hourly listings sync (runs at minute 15 of every hour to stagger)
SELECT cron.schedule(
  'sync-listings-hourly',
  '15 * * * *', -- Every hour at minute 15
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-listings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Option B: External Cron Service**
Use a service like cron-job.org or GitHub Actions to call:
```
POST https://your-project-ref.supabase.co/functions/v1/sync-web-content
POST https://your-project-ref.supabase.co/functions/v1/sync-listings
Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

**Option C: Manual Trigger**
You can manually trigger the syncs by calling:
```bash
# Sync web content (articles & testimonials)
curl -X POST https://your-project-ref.supabase.co/functions/v1/sync-web-content \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Sync listings
curl -X POST https://your-project-ref.supabase.co/functions/v1/sync-listings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## 3. App Environment Variables

Set these in your Expo/EAS build configuration or `.env` file:

### Required for production:

- **`EXPO_PUBLIC_SUPABASE_URL`** - Your Supabase project URL
- **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** - Your Supabase anonymous/public key

### Optional (telemetry):

- **`EXPO_PUBLIC_SENTRY_DSN`** - Sentry DSN for crash reporting (get from sentry.io)
- **`EXPO_PUBLIC_POSTHOG_API_KEY`** - PostHog API key for analytics (get from posthog.com)
- **`EXPO_PUBLIC_POSTHOG_HOST`** - PostHog host (defaults to `https://app.posthog.com`)

### Optional (legal/support links):

- **`EXPO_PUBLIC_PRIVACY_URL`** - Privacy policy URL (defaults to FTA website)
- **`EXPO_PUBLIC_TERMS_URL`** - Terms & conditions URL (defaults to FTA website)
- **`EXPO_PUBLIC_SUPPORT_EMAIL`** - Support email (defaults to `oliver.acton@ft-associates.com`)
- **`EXPO_PUBLIC_SUPPORT_URL`** - Support website URL (defaults to FTA contact page)

## 4. EAS Build Configuration

If using EAS Build, add environment variables in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
        "EXPO_PUBLIC_SENTRY_DSN": "your-sentry-dsn",
        "EXPO_PUBLIC_POSTHOG_API_KEY": "your-posthog-key"
      }
    }
  }
}
```

Or use EAS Secrets (recommended for sensitive values):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"
```

## 5. Verification Checklist

After deployment, verify:

- [ ] Leads can be submitted (test via `/inquire/[id]` or `/sell`)
- [ ] Email notifications are sent (check Resend dashboard)
- [ ] Rate limiting works (try submitting 4+ leads from same email in 10 minutes - 4th should fail)
- [ ] Admin can view leads (`/profile/admin/leads`)
- [ ] Listings sync from website (pull-to-refresh on Home/Search)
- [ ] **Web content sync works** (trigger sync function, check articles/testimonials tables in Supabase)
- [ ] **Articles load from Supabase** (check `/articles` screen - should use Supabase data)
- [ ] **Testimonials load from Supabase** (check `/testimonials` screen - should use Supabase data)
- [ ] **Listings sync works** (trigger sync-listings function, check listings table in Supabase)
- [ ] **Listings load from Supabase** (check Home/Search screens - should use Supabase data)
- [ ] Crash reporting works (trigger a test error, check Sentry)
- [ ] Analytics events fire (check PostHog dashboard)

## 6. Troubleshooting

### Email functions return 500 errors:
- Check that all required secrets are set in Supabase Edge Functions
- Verify `SUPABASE_SERVICE_ROLE_KEY` has access to `public.leads` table
- Check Resend API key is valid and sender email is verified

### Rate limiting too strict:
- Edit the rate limit constants in `supabase/functions/inquiry-email/index.ts` and `seller-intake-email/index.ts`
- Current: max 3 emails per email/phone per 10 minutes

### Listings not syncing:
- Check network connectivity
- Verify FTA website URL is accessible: `https://www.ft-associates.com/buying-a-dental-practice/dental-practices-for-sale/`
- Check sync metadata in SQLite `meta` table (key: `listingsSync.lastSyncAt`)

### Articles/Testimonials not loading:
- Verify `sync-web-content` function is deployed and secrets are set
- Check that sync function has run successfully (check Supabase Edge Functions logs)
- Verify articles/testimonials tables exist and have data (check Supabase Table Editor)
- App will fallback to web scraping if Supabase fails, so check console logs for fallback messages
- Ensure RLS policies allow public read access (check `supabase/migrations/create_web_content_tables.sql`)

### Listings not loading from Supabase:
- Verify `sync-listings` function is deployed and secrets are set
- Check that sync function has run successfully (check Supabase Edge Functions logs)
- Verify listings table exists and has data (check Supabase Table Editor)
- App will fallback to local SQLite if Supabase fails, so check console logs for fallback messages
- Ensure RLS policies allow public read access (check `supabase/migrations/create_listings_table.sql`)
- Note: Listings sync fetches detail pages with rate limiting (500ms delay), so full sync may take several minutes

### Production guard screen shows:
- Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in build
- Check that `app.json` doesn't override these values
