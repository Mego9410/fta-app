# Pre-Launch Checklist

Use this checklist to verify everything is working before going live.

## ✅ Database & Backend

- [ ] SQL migration applied (`notified_at` column exists in `public.leads`)
- [ ] Supabase Edge Function secrets configured:
  - [ ] `RESEND_API_KEY`
  - [ ] `INQUIRY_FROM_EMAIL`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Test email sent successfully (check Resend dashboard)
- [ ] Rate limiting works (try 4+ submissions from same email - 4th should be blocked)

## ✅ App Configuration

- [ ] `EXPO_PUBLIC_SUPABASE_URL` set in production build
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in production build
- [ ] Production guard screen does NOT appear (means config is correct)
- [ ] Optional: `EXPO_PUBLIC_SENTRY_DSN` set (crash reporting)
- [ ] Optional: `EXPO_PUBLIC_POSTHOG_API_KEY` set (analytics)

## ✅ Core Features

- [ ] **Listings sync**: Pull-to-refresh on Home/Search updates listings
- [ ] **Lead submission**: Inquiry form (`/inquire/[id]`) submits successfully
- [ ] **Seller intake**: Sell form (`/sell`) submits successfully
- [ ] **Email delivery**: Both inquiry and seller emails arrive in inbox
- [ ] **Offline handling**: Submit lead offline, verify it sends when back online
- [ ] **Admin access**: Admin can view leads at `/profile/admin/leads`
- [ ] **Favorites**: Save/unsave listings works across app restarts

## ✅ User Experience

- [ ] Onboarding flow completes without errors
- [ ] Search filters work correctly
- [ ] Profile settings save and persist
- [ ] Legal links open in-app (`/profile` → Support/Privacy/Terms)
- [ ] Delete account screen accessible (`/profile` → Delete account)

## ✅ Security & Reliability

- [ ] No demo-mode auth/admin in production build
- [ ] Rate limiting prevents spam (test with rapid submissions)
- [ ] Outbox retry works (submit offline, verify sync when online)
- [ ] Crash reporting captures errors (if Sentry configured)
- [ ] Analytics events fire (if PostHog configured)

## ✅ Content

- [ ] Listings display correctly from website sync
- [ ] "Last updated" timestamps show on Home/Search
- [ ] Articles and testimonials load from website
- [ ] No broken images or links

## 🚀 Ready to Launch

Once all items are checked, you're ready to:
1. Submit to App Store (iOS)
2. Submit to Google Play (Android)
3. Monitor Sentry for crashes
4. Track user behavior in PostHog
5. Review leads in Admin dashboard

## Post-Launch Monitoring

- Check Resend dashboard daily for email delivery issues
- Monitor Supabase Edge Function logs for errors
- Review Sentry for crash reports
- Track onboarding completion rate in PostHog
- Watch for unusual lead submission patterns (potential spam)
