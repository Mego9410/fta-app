import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getPostSignInRoute } from '@/src/auth/postAuthRouting';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function Login() {
  const theme = useColorScheme() ?? 'light';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return Alert.alert('Email is required');
    if (!password || password.length < 8) return Alert.alert('Password must be at least 8 characters');

    setBusy(true);
    try {
      // Demo mode (pre-Supabase): accept any credentials and continue into the app.
      if (!isSupabaseConfigured) {
        router.replace('/');
        return;
      }

      const supabase = requireSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('No user returned from sign-in.');

      const nextRoute = await getPostSignInRoute(supabase, userId);
      router.replace(nextRoute);
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.shell}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Image
              accessibilityLabel="Frank Taylor & Associates logo"
              source={require('../assets/images/FTA.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              {isSupabaseConfigured
                ? 'Use your email and password to continue.'
                : 'Demo login — Supabase isn’t connected yet.'}
            </Text>
          </View>

          <View style={styles.form}>
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
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
            />

            <PrimaryButton title={busy ? 'Please wait…' : 'Sign in'} onPress={onSubmit} disabled={busy} />

            <View style={styles.links}>
              <SecondaryButton
                title="Forgot password?"
                onPress={() =>
                  Alert.alert('Coming soon', 'Password reset will be available once Supabase auth is connected.')
                }
                disabled={busy}
              />
              <SecondaryButton
                title="Create an account"
                onPress={() => router.push(isSupabaseConfigured ? '/(onboarding)/auth' : '/(onboarding)/welcome')}
                disabled={busy}
              />
              <SecondaryButton title="Back" onPress={() => router.back()} disabled={busy} />
            </View>

            {!isSupabaseConfigured ? (
              <Text style={[styles.demoNote, { color: Colors[theme].text }]}>
                Any email/password will work for now.
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: ui.spacing.xl, justifyContent: 'center' },
  shell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  card: {
    gap: ui.spacing.lg,
    padding: ui.spacing.xl,
    borderRadius: ui.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.04)',
    ...ui.shadow.card,
  },
  header: { alignItems: 'center', gap: ui.spacing.sm },
  logo: { width: 220, height: 72, marginBottom: 2 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 14, opacity: 0.78, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
  form: { gap: ui.spacing.md },
  links: { gap: ui.spacing.sm },
  demoNote: { fontSize: 12, opacity: 0.65, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});

