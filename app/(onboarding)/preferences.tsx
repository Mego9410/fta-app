import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/Themed';
import { getLocalOnboardingState, patchLocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function PreferencesStep() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          const local = await getLocalOnboardingState();
          if (!cancelled) {
            setPushEnabled(!!local.preferences.pushNotificationsEnabled);
            setEmailEnabled(local.preferences.emailNotificationsEnabled ?? true);
          }
        } else {
          const supabase = requireSupabase();
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (!session) {
            router.replace('/(onboarding)/auth');
            return;
          }
          const userId = session.user.id;

          const { data: prefs, error } = await supabase
            .from('user_preferences')
            .select('search_radius_km, push_notifications_enabled, email_notifications_enabled')
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;

          if (!cancelled) {
            setPushEnabled(!!prefs?.push_notifications_enabled);
            setEmailEnabled(prefs?.email_notifications_enabled ?? true);
          }
        }
      } catch (e: any) {
        Alert.alert('Failed to load preferences', e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFinish() {
    setBusy(true);
    try {
      if (!isSupabaseConfigured) {
        await patchLocalOnboardingState({
          step: 'done',
          preferences: {
            pushNotificationsEnabled: pushEnabled,
            emailNotificationsEnabled: emailEnabled,
          },
        } as any);
      } else {
        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          router.replace('/(onboarding)/auth');
          return;
        }
        const userId = session.user.id;

        const { error: upsertErr } = await supabase.from('user_preferences').upsert(
          {
            user_id: userId,
            push_notifications_enabled: pushEnabled,
            email_notifications_enabled: emailEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (upsertErr) throw upsertErr;

        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ onboarding_step: 'done', updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (profileErr) throw profileErr;
      }

      router.push('/(onboarding)/done');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <Text style={styles.kicker}>Step 3 of 3</Text>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.kicker}>Step 3 of 3</Text>
      <Text style={styles.title}>Preferences</Text>
      <Text style={styles.subtitle}>You can change these anytime later.</Text>

      <View style={styles.form}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Push notifications</Text>
            <Text style={styles.rowBody}>Off by default.</Text>
          </View>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Email updates</Text>
            <Text style={styles.rowBody}>On by default.</Text>
          </View>
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton title={busy ? 'Saving…' : 'Finish setup'} onPress={onFinish} disabled={busy} />
        <SecondaryButton title="Back" onPress={() => router.back()} disabled={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: ui.spacing.xl, gap: ui.spacing.sm, justifyContent: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', opacity: 0.65 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { opacity: 0.75, marginBottom: ui.spacing.md },
  form: { gap: ui.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ui.spacing.md,
    paddingVertical: 6,
  },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowBody: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  actions: { marginTop: ui.spacing.lg, gap: ui.spacing.sm },
});

