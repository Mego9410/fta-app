import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { getPostSignInRoute } from '@/src/auth/postAuthRouting';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function Auth() {
  // Local-mode: no auth yet. Treat this screen as a passthrough.
  if (!isSupabaseConfigured) {
    return (
      <View style={[styles.page, { justifyContent: 'center' }]}>
        <View style={styles.card}>
          <Text style={styles.title}>Local mode</Text>
          <Text style={{ opacity: 0.75 }}>
            Supabase isn’t connected yet, so we’ll save your onboarding locally for now.
          </Text>
          <PrimaryButton title="Continue" onPress={() => router.replace('/(onboarding)/profile')} />
          <SecondaryButton title="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => (mode === 'signUp' ? 'Create your account' : 'Sign in'), [mode]);

  async function ensureProfileExists(userId: string) {
    // full_name is NOT NULL in schema; empty string is acceptable until the user fills it in.
    const supabase = requireSupabase();
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: '',
        onboarding_step: 'profile',
      },
      { onConflict: 'id' },
    );
    if (error) throw error;
  }

  async function onSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return Alert.alert('Email is required');
    if (!password || password.length < 8) return Alert.alert('Password must be at least 8 characters');

    setBusy(true);
    try {
      const supabase = requireSupabase();
      if (mode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
        if (error) throw error;
        const userId = data.user?.id;
        if (userId) await ensureProfileExists(userId);
        router.replace('/(onboarding)/profile');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        const userId = data.user?.id;
        if (userId) await ensureProfileExists(userId);

        if (!userId) throw new Error('No user returned from sign-in.');
        const nextRoute = await getPostSignInRoute(supabase, userId);
        router.replace(nextRoute);
      }
    } catch (e: any) {
      Alert.alert('Auth failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
        />

        <PrimaryButton title={busy ? 'Please wait…' : 'Continue'} onPress={onSubmit} disabled={busy} />

        <SecondaryButton
          title={mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          onPress={() => setMode((m) => (m === 'signUp' ? 'signIn' : 'signUp'))}
          disabled={busy}
        />

        <SecondaryButton title="Back" onPress={() => router.back()} disabled={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: ui.spacing.xl, justifyContent: 'center' },
  card: { gap: ui.spacing.md, padding: ui.spacing.xl, borderRadius: ui.radius.lg },
  title: { fontSize: 22, fontWeight: '900', marginBottom: ui.spacing.sm },
});

