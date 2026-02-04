import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
    consumeAdminForceLoginNextOpen,
    consumeAdminForceOnboardingNextOpen,
    getLocalOnboardingState,
    isAdminSkipOnboardingEnabled,
} from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { LoadingScreen } from '@/src/ui/components/LoadingScreen';

type OnboardingStep = 'profile' | 'buyer' | 'preferences' | 'done';

function stepToRoute(step: string | null | undefined): string {
  const s = (step ?? 'profile') as OnboardingStep;
  if (s === 'buyer') return '/(onboarding)/buyer';
  if (s === 'preferences') return '/(onboarding)/preferences';
  if (s === 'done') return '/(onboarding)/done';
  return '/(onboarding)/profile';
}

export default function IndexGate() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // One-shot admin override: force login screen on next open.
        // Defensive: if Metro serves an older bundle of onboardingLocalRepo, this export may be missing.
        const shouldForceLogin =
          typeof consumeAdminForceLoginNextOpen === 'function'
            ? await consumeAdminForceLoginNextOpen()
            : false;
        if (shouldForceLogin) {
          router.replace('/login');
          return;
        }

        // One-shot admin override: always show onboarding welcome on next open.
        if (await consumeAdminForceOnboardingNextOpen()) {
          router.replace('/(onboarding)/welcome');
          return;
        }

        if (await isAdminSkipOnboardingEnabled()) {
          router.replace('/(tabs)');
          return;
        }

        if (!isSupabaseConfigured) {
          const local = await getLocalOnboardingState();
          // Normal behavior: completed users go to tabs; otherwise resume onboarding.
          if (local.completedAt) {
            router.replace('/(tabs)');
            return;
          }

          // Keep welcome as the entry point for the very first step,
          // but resume mid-onboarding steps directly.
          if ((local.step ?? 'profile') === 'profile') {
            router.replace('/(onboarding)/welcome');
          } else {
            router.replace(stepToRoute(local.step));
          }
          return;
        }

        const supabase = requireSupabase();
        let { data } = await supabase.auth.getSession();
        let session = data.session;
        if (!session) {
          // Retry once after short delay (SecureStore may not be ready on cold start)
          await new Promise((r) => setTimeout(r, 400));
          const retry = await supabase.auth.getSession();
          session = retry.data.session;
        }
        if (!session) {
          router.replace('/(onboarding)/welcome');
          return;
        }

        const userId = session.user.id;
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at, onboarding_step')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;

        if (!profile) {
          // First time this user is seen on this device (or profile row was removed).
          const { error: upsertErr } = await supabase.from('profiles').upsert(
            {
              id: userId,
              full_name: '',
              onboarding_step: 'profile',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          );
          if (upsertErr) throw upsertErr;
          router.replace('/(onboarding)/welcome');
          return;
        }

        // Normal behavior: completed users go to tabs; otherwise resume onboarding.
        if (profile.onboarding_completed_at) {
          router.replace('/(tabs)');
          return;
        }

        const step = (profile.onboarding_step ?? 'profile') as OnboardingStep;
        if (step === 'profile') {
          router.replace('/(onboarding)/welcome');
        } else {
          router.replace(stepToRoute(step));
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('ready');
          router.replace('/(onboarding)/welcome');
        }
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <LoadingScreen />;
}

