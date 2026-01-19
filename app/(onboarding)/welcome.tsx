import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { setAdminSkipOnboardingEnabled } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured } from '@/src/supabase/client';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function Welcome() {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Image
          accessibilityLabel="Frank Taylor & Associates logo"
          source={require('../../assets/images/FTA.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Find the right dental practice—faster.</Text>
        <Text style={styles.subtitle}>
          We connect buyers and sellers of dental practices and help you find opportunities that
          match your criteria.
        </Text>

        <View style={styles.whyBox}>
          <Text style={styles.whyTitle}>Why we ask for your details</Text>
          <Text style={styles.whyItem}>• To personalise listings and alerts.</Text>
          <Text style={styles.whyItem}>• To contact you about relevant opportunities.</Text>
          <Text style={styles.whyItem}>• To keep your account secure.</Text>
          <Text style={styles.whyFootnote}>
            Your personal info is required to continue (including email).
          </Text>
        </View>

        <PrimaryButton
          title="I’m committed"
          onPress={() =>
            router.push(isSupabaseConfigured ? '/(onboarding)/auth' : '/(onboarding)/profile')
          }
        />

        <SecondaryButton title="Already have an account? Sign in" onPress={() => router.push('/login')} />

        <SecondaryButton
          title="Admin: Skip onboarding"
          onPress={async () => {
            await setAdminSkipOnboardingEnabled(true);
            router.replace('/(tabs)');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: ui.spacing.xl, justifyContent: 'center' },
  card: {
    gap: ui.spacing.lg,
    padding: ui.spacing.xl,
    borderRadius: ui.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  logo: { width: 220, height: 72, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 14, opacity: 0.82, lineHeight: 20, textAlign: 'center' },
  whyBox: {
    width: '100%',
    gap: ui.spacing.sm,
    padding: ui.spacing.lg,
    borderRadius: ui.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  whyTitle: { fontSize: 13, fontWeight: '900', opacity: 0.75, textTransform: 'uppercase' },
  whyItem: { fontSize: 14, opacity: 0.85, lineHeight: 20 },
  whyFootnote: { fontSize: 12, opacity: 0.7, lineHeight: 18, marginTop: 2 },
});

