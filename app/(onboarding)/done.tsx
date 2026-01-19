import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { markLocalOnboardingComplete } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { ui } from '@/src/ui/theme';

export default function Done() {
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          await markLocalOnboardingComplete();
        } else {
          const supabase = requireSupabase();
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (!session) {
            router.replace('/(onboarding)/auth');
            return;
          }
          const userId = session.user.id;
          const nowIso = new Date().toISOString();

          const { error } = await supabase
            .from('profiles')
            .update({
              onboarding_step: 'done',
              onboarding_completed_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', userId);
          if (error) throw error;
        }
      } catch (e: any) {
        Alert.alert('Almost there', e?.message ?? String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>You’re all set</Text>
        <Text style={styles.subtitle}>Your account and preferences have been saved.</Text>
        <PrimaryButton
          title={busy ? 'Finishing…' : 'Go to listings'}
          disabled={busy}
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: ui.spacing.xl, justifyContent: 'center' },
  card: { gap: ui.spacing.lg, padding: ui.spacing.xl, borderRadius: ui.radius.lg },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { opacity: 0.75 },
});

