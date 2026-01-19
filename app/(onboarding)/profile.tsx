import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { getLocalOnboardingState, patchLocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function ProfileStep() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [authEmail, setAuthEmail] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          const local = await getLocalOnboardingState();
          if (!cancelled) {
            setFullName(local.profile.fullName);
            setEmail(local.profile.email);
            setPhone(local.profile.phone);
            setLocationLabel(local.profile.homeLocationLabel);
          }
        } else {
          const supabase = requireSupabase();
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (!session) {
            router.replace('/(onboarding)/auth');
            return;
          }

          const sessionEmail = session.user.email ?? '';
          if (!cancelled) setAuthEmail(sessionEmail);

          const userId = session.user.id;
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, phone, home_location_label')
            .eq('id', userId)
            .maybeSingle();

          if (error) throw error;

          if (!cancelled) {
            setFullName(profile?.full_name ?? '');
            setEmail(sessionEmail);
            setPhone(profile?.phone ?? '');
            setLocationLabel(profile?.home_location_label ?? '');
          }
        }
      } catch (e: any) {
        Alert.alert('Failed to load profile', e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onContinue() {
    const name = fullName.trim();
    if (!name) return Alert.alert('Full name is required');

    const nextEmail = email.trim();
    if (!nextEmail) return Alert.alert('Email is required');
    if (!nextEmail.includes('@')) return Alert.alert('Email looks invalid');

    const nextPhone = phone.trim();
    if (!nextPhone) return Alert.alert('Phone is required');

    setBusy(true);
    try {
      if (!isSupabaseConfigured) {
        await patchLocalOnboardingState({
          step: 'buyer',
          profile: {
            fullName: name,
            email: nextEmail,
            phone: nextPhone,
            homeLocationLabel: locationLabel.trim(),
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

        const sessionEmail = session.user.email ?? '';
        if (!sessionEmail) {
          Alert.alert('Email is required', 'Please sign in again so we can capture your email.');
          router.replace('/(onboarding)/auth');
          return;
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: name,
            phone: nextPhone || null,
            home_location_label: locationLabel.trim() || null,
            onboarding_step: 'buyer',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        if (error) throw error;
      }

      router.push('/(onboarding)/buyer');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <Text style={styles.kicker}>Step 1 of 3</Text>
        <Text style={styles.title}>Your details</Text>
        <Text style={styles.subtitle}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.kicker}>Step 1 of 3</Text>
      <Text style={styles.title}>Your details</Text>
      <Text style={styles.subtitle}>We need this to personalise listings and contact you.</Text>

      <View style={styles.form}>
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+44 7…"
          keyboardType="phone-pad"
        />
        <Field
          label="Location (optional)"
          value={locationLabel}
          onChangeText={setLocationLabel}
          placeholder="Postcode or city"
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton title={busy ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={busy} />
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
  actions: { marginTop: ui.spacing.lg, gap: ui.spacing.sm },
});

