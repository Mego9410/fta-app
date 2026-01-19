import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import {
  consumeAdminForceOnboardingNextOpen,
  consumeAdminForceLoginNextOpen,
  getLocalOnboardingState,
  isAdminSkipOnboardingEnabled,
} from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { ui } from '@/src/ui/theme';

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
        const { data } = await supabase.auth.getSession();
        const session = data.session;
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
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <View style={styles.page}>
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }

  // Navigation happens via router.replace above.
  return (
    <View style={styles.page}>
      <Text style={styles.text}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ui.spacing.xl },
  text: { fontSize: 14, fontWeight: '700', opacity: 0.7 },
});

