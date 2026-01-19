import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { getLocalOnboardingState, patchLocalOnboardingState, type LocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { getProfile } from '@/src/supabase/profileRepo';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

type DetailsModel = {
  source: 'local' | 'supabase';
  fullName: string;
  email: string;
  phone: string;
  onboardingStep: string;
  onboardingCompletedAt: string | null;
};

function modelFromLocal(local: LocalOnboardingState): DetailsModel {
  return {
    source: 'local',
    fullName: local.profile.fullName ?? '',
    email: local.profile.email ?? '',
    phone: local.profile.phone ?? '',
    onboardingStep: local.step ?? 'profile',
    onboardingCompletedAt: local.completedAt ?? null,
  };
}

export default function ProfileDetailsScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();

  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;

  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<DetailsModel | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const local = await getLocalOnboardingState();
      const m = modelFromLocal(local);
      setModel(m);
      setName(m.fullName);
      setEmail(m.email);
      setPhone(m.phone);
      return;
    }

    const supabase = requireSupabase();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      // No session: fall back to local state for a consistent UX.
      const local = await getLocalOnboardingState();
      const m = modelFromLocal(local);
      setModel(m);
      setName(m.fullName);
      setEmail(m.email);
      setPhone(m.phone);
      return;
    }

    const userId = session.user.id;
    const profile = await getProfile(userId);
    const authEmail = session.user.email ?? '';

    const m: DetailsModel = {
      source: 'supabase',
      fullName: profile?.full_name ?? '',
      email: authEmail,
      phone: profile?.phone ?? '',
      onboardingStep: profile?.onboarding_step ?? 'profile',
      onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
    };

    setModel(m);
    setName(m.fullName);
    setEmail(m.email);
    setPhone(m.phone);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e: any) {
        if (!cancelled) Alert.alert('Failed to load details', e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const cardBg = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const border = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  const isDirty = useMemo(() => {
    if (!model) return false;
    return (
      name.trim() !== (model.fullName ?? '').trim() ||
      email.trim() !== (model.email ?? '').trim() ||
      phone.trim() !== (model.phone ?? '').trim()
    );
  }, [email, model, name, phone]);

  const onCancel = useCallback(() => {
    if (!model) return;
    setName(model.fullName);
    setEmail(model.email);
    setPhone(model.phone);
    setEditMode(false);
  }, [model]);

  const onSave = useCallback(async () => {
    if (!model) return;

    const nextName = name.trim();
    const nextEmail = email.trim();
    const nextPhone = phone.trim();

    if (!nextName) {
      Alert.alert('Fix required', 'Name is required.');
      return;
    }

    if (nextEmail && !nextEmail.includes('@')) {
      Alert.alert('Fix required', 'Email looks invalid.');
      return;
    }

    setSaving(true);
    try {
      if (model.source === 'local') {
        await patchLocalOnboardingState({
          profile: {
            fullName: nextName,
            email: nextEmail,
            phone: nextPhone,
          },
        } as any);
      } else {
        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          Alert.alert('Not signed in', 'Please sign in to update account details.');
          return;
        }

        const userId = session.user.id;

        // Update profile table (name/phone)
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            full_name: nextName,
            phone: nextPhone || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        if (profileErr) throw profileErr;

        // Update auth email (if changed)
        const currentEmail = session.user.email ?? '';
        if (nextEmail && nextEmail !== currentEmail) {
          const { error: authErr } = await supabase.auth.updateUser({ email: nextEmail });
          if (authErr) throw authErr;
          Alert.alert(
            'Email update requested',
            'Check your inbox to confirm the email change. It may not update here until confirmed.',
          );
        }
      }

      await load();
      setEditMode(false);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }, [email, load, model, name, phone]);

  if (loading || !model) {
    return (
      <View style={styles.loading}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile"
          title="Your details"
          subtitle="Loading…"
          style={{ paddingHorizontal: 0 }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: bottomPad },
        ]}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile"
          title="Your details"
          subtitle={`Source: ${model.source === 'supabase' ? 'Account (Supabase)' : 'On-device (local)'}`}
          style={{ paddingHorizontal: 0 }}
        />

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={styles.sectionTitle}>Contact</Text>

          {editMode ? (
            <View style={styles.form}>
              <Field label="Name" value={name} onChangeText={setName} placeholder="Jane Doe" />
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
                autoCapitalize="none"
              />

              <View style={styles.actions}>
                <PrimaryButton
                  title={saving ? 'Saving…' : 'Save'}
                  onPress={onSave}
                  disabled={saving || !isDirty}
                />
                <SecondaryButton title="Cancel" onPress={onCancel} disabled={saving} />
              </View>
            </View>
          ) : (
            <View style={styles.readOnly}>
              <KeyValue label="Name" value={model.fullName.trim() ? model.fullName.trim() : 'Not set'} />
              <KeyValue label="Email" value={model.email.trim() ? model.email.trim() : 'Not set'} />
              <KeyValue label="Phone" value={model.phone.trim() ? model.phone.trim() : 'Not set'} />
              <PrimaryButton title="Edit" onPress={() => setEditMode(true)} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: 10,
  },
  container: {
    paddingHorizontal: ui.layout.screenPaddingX,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '900', opacity: 0.75, textTransform: 'uppercase' },
  form: { gap: 12 },
  actions: { gap: 10, marginTop: 4 },
  readOnly: { gap: 10 },
  kvRow: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 2,
  },
  kvLabel: { fontSize: 12, fontWeight: '900', opacity: 0.65, textTransform: 'uppercase' },
  kvValue: { fontSize: 15, fontWeight: '800', opacity: 0.9 },
});

