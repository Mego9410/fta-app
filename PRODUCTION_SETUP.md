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
# Use Supabase CLI via npx (no global install required)
# Login to Supabase
npx supabase login

# Link your project (get project-ref from Supabase Dashboard → Project Settings → General)
npx supabase link --project-ref your-project-ref

# Deploy the sync functions
npx supabase functions deploy sync-web-content
npx supabase functions deploy sync-listings
```

**Get enquiry emails sending (Resend):** The app sends enquiry emails via the `inquiry-email` Edge Function, which calls Resend. The function runs on Supabase’s servers, so it does **not** use your app’s `.env` — it only sees **Supabase Edge Function secrets**. To get emails sending:

1. **Deploy the function** (if not already):  
   `npx supabase functions deploy inquiry-email`

2. **Get a Resend API key**: Sign up at [resend.com](https://resend.com), create an API key, and (if you want to send from your domain) add and verify your domain in Resend.

3. **Set secrets in Supabase** (Dashboard → **Edge Functions** → **Secrets**, or CLI `npx supabase secrets set RESEND_API_KEY=re_xxx`):
   - **`RESEND_API_KEY`** – Your Resend API key (e.g. `re_xxxxx`)
   - **`INQUIRY_FROM_EMAIL`** – Sender address. For internal use only, **`onboarding@resend.dev`** is fine (no domain verification needed). For production with your own domain, use a verified address (e.g. `oliver.acton@ft-associates.com`).

   Supabase already provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function.

4. **Test**: Submit an enquiry from the app; the function will send the email to `oliver.acton@ft-associates.com` (or the value of `INQUIRY_TO_EMAIL` if set).

### 2.2 Edge Function Secrets

Set these secrets in your Supabase project dashboard (Settings → Edge Functions → Secrets):

#### Required for email functions (`inquiry-email` and `seller-intake-email`):

- **`RESEND_API_KEY`** - Your Resend API key for sending emails
- **`INQUIRY_FROM_EMAIL`** - Sender email address (must be a verified domain in Resend; e.g. `oliver.acton@ft-associates.com` or `noreply@ft-associates.com`)
- **`SUPABASE_URL`** - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **`SUPABASE_SERVICE_ROLE_KEY`** - Your Supabase service role key (for rate limiting checks)

**Resend domain verification (ft-associates.com):** To send from `@ft-associates.com`, add this DKIM TXT record in your DNS for `ft-associates.com` (Resend will then verify the domain):

| Type | Name/Host | Value |
|------|-----------|-------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNtCqTmTkHgAMev8Hq9fEnw0JWf7ME3it1BMKHuXiBhI737hwd+OCXB2NWVrG32CcaiJIK9G1qd+KaRlzrGyMFpUVhlLsf3yb98AQcVTUwJyyDTe+OjvX8n2kbgvAY/miAi/IqKx6BDRLFSqrrzUdXtgmhClnjpl1wlZSD78VfvQIDAQAB` |

After the record propagates, verify the domain in the [Resend dashboard](https://resend.com/domains), then set `INQUIRY_FROM_EMAIL` to a verified address (e.g. `oliver.acton@ft-associates.com`). All inquiry and seller-intake emails are sent **to** `oliver.acton@ft-associates.com` by default.

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
