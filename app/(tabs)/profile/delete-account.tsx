import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { LINKS } from '@/constants/Links';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

function buildMailto(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function DeleteAccountScreen() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) return;
        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return;
        if (!cancelled) setEmail(session.user.email ?? '');
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader
        mode="tabs"
        fallbackHref="/profile"
        title="Delete account"
        subtitle="Request account deletion and data removal."
        style={{ paddingHorizontal: 0 }}
      />

      <View style={styles.card}>
        <Text style={styles.body}>
          To delete your account, we currently handle requests manually. Tap below to email support.
        </Text>
        {email.trim() ? <Text style={styles.bodyMuted}>Signed in as: {email.trim()}</Text> : null}
      </View>

      <PrimaryButton
        title="Email support to delete my account"
        onPress={async () => {
          const subject = 'Account deletion request';
          const body = [
            'Please delete my account and associated data.',
            '',
            email.trim() ? `Account email: ${email.trim()}` : 'Account email: (not signed in)',
            '',
            'Thanks,',
          ].join('\n');
          const url = buildMailto(LINKS.supportEmail, subject, body);
          const canOpen = await Linking.canOpenURL(url);
          if (!canOpen) {
            Alert.alert('Could not open mail app', `Please email: ${LINKS.supportEmail}`);
            return;
          }
          await Linking.openURL(url);
        }}
      />

      <SecondaryButton
        title="Sign out"
        onPress={async () => {
          try {
            if (isSupabaseConfigured) {
              const supabase = requireSupabase();
              await supabase.auth.signOut();
            }
          } finally {
            router.replace('/(tabs)');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: 12,
    gap: 8,
  },
  body: { fontSize: 14, fontWeight: '700', opacity: 0.85, lineHeight: 20 },
  bodyMuted: { fontSize: 13, fontWeight: '700', opacity: 0.7 },
});

