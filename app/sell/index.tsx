import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Colors from '@/constants/Colors';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { createLead } from '@/src/data/leadsRepo';
import { getLocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { notifySellerIntakeByEmail } from '@/src/notifications/sellerIntakeEmail';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { getProfile } from '@/src/supabase/profileRepo';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { Pill } from '@/src/ui/components/Pill';
import { ui } from '@/src/ui/theme';

type IncomeMix = 'NHS' | 'Private' | 'Mixed';
type PracticeType = 'General' | 'Specialist' | 'Specialist Referral' | 'General with some Specialist';
type Tenure = 'Freehold' | 'Leasehold';
type Readiness = 'Ready now' | 'Future';

export default function SellYourBusinessScreen() {
  const theme = useColorScheme() ?? 'light';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [callbackWindow, setCallbackWindow] = useState('');

  const [location, setLocation] = useState('');
  const [incomeMix, setIncomeMix] = useState<IncomeMix | null>(null);
  const [practiceType, setPracticeType] = useState<PracticeType | null>(null);
  const [surgeriesCount, setSurgeriesCount] = useState<number>(2);
  const [tenure, setTenure] = useState<Tenure | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  const [timeline, setTimeline] = useState('');
  const [revenueRange, setRevenueRange] = useState('');
  const [earningsRange, setEarningsRange] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [nameEdited, setNameEdited] = useState(false);
  const [emailEdited, setEmailEdited] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);

  const prefillFromAccount = useCallback(async () => {
    const setIfEmpty = (current: string, set: (v: string) => void, next: string, edited: boolean) => {
      if (edited) return;
      if (current.trim().length > 0) return;
      if (next.trim().length === 0) return;
      set(next);
    };

    // If Supabase is unavailable/unconfigured, fall back to local onboarding profile.
    if (!isSupabaseConfigured) {
      const local = await getLocalOnboardingState();
      setIfEmpty(name, setName, local.profile.fullName ?? '', nameEdited);
      setIfEmpty(email, setEmail, local.profile.email ?? '', emailEdited);
      setIfEmpty(phone, setPhone, local.profile.phone ?? '', phoneEdited);
      return;
    }

    const supabase = requireSupabase();
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      const local = await getLocalOnboardingState();
      setIfEmpty(name, setName, local.profile.fullName ?? '', nameEdited);
      setIfEmpty(email, setEmail, local.profile.email ?? '', emailEdited);
      setIfEmpty(phone, setPhone, local.profile.phone ?? '', phoneEdited);
      return;
    }

    const authEmail = session.user.email ?? '';
    const profile = await getProfile(session.user.id);

    setIfEmpty(name, setName, profile?.full_name ?? '', nameEdited);
    setIfEmpty(email, setEmail, authEmail, emailEdited);
    setIfEmpty(phone, setPhone, profile?.phone ?? '', phoneEdited);
  }, [email, emailEdited, name, nameEdited, phone, phoneEdited]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await prefillFromAccount();
      } catch (e: any) {
        // Silent-ish: this is a "nice to have" UX improvement, not a blocker.
        if (!cancelled) {
          // If something goes wrong (e.g., offline), keep the form usable.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillFromAccount]);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    location.trim().length > 0 &&
    !!incomeMix &&
    !!practiceType &&
    surgeriesCount > 0 &&
    !!tenure &&
    !!readiness;

  if (submitted) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Thanks — we’ll be in touch"
          subtitle="We’ve received your callback request. A broker will follow up soon."
          fallbackHref="/(tabs)"
          style={{ paddingHorizontal: 0 }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Sell a practice"
          subtitle="Fill this in and we’ll call you back."
          fallbackHref="/(tabs)"
          style={{ paddingHorizontal: 0 }}
        />

      <View style={styles.form}>
        <Field
          label="Your name *"
          value={name}
          onChangeText={(v) => {
            setNameEdited(true);
            setName(v);
          }}
          placeholder="Full name"
        />
        <Field
          label="Email *"
          value={email}
          onChangeText={(v) => {
            setEmailEdited(true);
            setEmail(v);
          }}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Phone *"
          value={phone}
          onChangeText={(v) => {
            setPhoneEdited(true);
            setPhone(v);
          }}
          placeholder="Your number"
          keyboardType="phone-pad"
        />
        <Field
          label="Best time to call (optional)"
          value={callbackWindow}
          onChangeText={setCallbackWindow}
          placeholder="e.g., Weekdays after 5pm"
        />

        <View style={styles.divider} />

        <Field label="Location *" value={location} onChangeText={setLocation} placeholder="Town / postcode" />

        <ChoiceGroup
          title="Income mix *"
          subtitle="Tap one"
          value={incomeMix}
          onChange={setIncomeMix}
          options={['NHS', 'Private', 'Mixed']}
        />

        <ChoiceGroup
          title="Type of practice *"
          subtitle="Tap one"
          value={practiceType}
          onChange={setPracticeType}
          options={['General', 'Specialist', 'Specialist Referral', 'General with some Specialist']}
        />

        <View style={[styles.group, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>How many surgeries? *</Text>
          </View>
          <View style={styles.surgeriesRow}>
            <Pill label="−" onPress={() => setSurgeriesCount((n) => Math.max(1, n - 1))} />
            <View style={[styles.surgeriesValue, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }]}>
              <Text style={styles.surgeriesValueText}>{surgeriesCount}</Text>
            </View>
            <Pill label="+" onPress={() => setSurgeriesCount((n) => Math.min(20, n + 1))} />
          </View>
          <Text style={styles.groupHint}>Use + / − (max 20). If you have more, add a note below.</Text>
        </View>

        <ChoiceGroup
          title="Freehold or leasehold? *"
          subtitle="Tap one"
          value={tenure}
          onChange={setTenure}
          options={['Freehold', 'Leasehold']}
        />

        <ChoiceGroup
          title="Ready now? *"
          subtitle="Tap one"
          value={readiness}
          onChange={setReadiness}
          options={['Ready now', 'Future']}
        />

        <Field label="Timeline (optional)" value={timeline} onChangeText={setTimeline} placeholder="e.g., 0–3 months / 6–12 months" />
        <Field label="Fee income / turnover (optional)" value={revenueRange} onChangeText={setRevenueRange} placeholder="e.g., £500k–£750k" />
        <Field label="Net profit / EBITDA (optional)" value={earningsRange} onChangeText={setEarningsRange} placeholder="e.g., £150k–£250k" />
        <Field
          label="Anything else? (optional)"
          value={message}
          onChangeText={setMessage}
          placeholder="Anything you’d like us to know. Confidential info is OK here."
          multiline
        />

        <PrimaryButton
          disabled={!canSubmit || submitting}
          title={submitting ? 'Submitting…' : 'Request callback'}
          onPress={async () => {
            if (!canSubmit) {
              Alert.alert(
                'Missing info',
                'Please complete all required fields: name, email, phone, location, income mix, practice type, surgeries, freehold/leasehold, and ready now/future.',
              );
              return;
            }
            setSubmitting(true);
            try {
              const lead = await createLead({
                type: 'sellerIntake',
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                callbackWindow: callbackWindow.trim() || null,
                message: message.trim() || null,
                industry: 'Dental practice',
                location: location.trim() || null,
                incomeMix,
                practiceType,
                surgeriesCount,
                tenure,
                readiness,
                timeline: timeline.trim() || null,
                revenueRange: revenueRange.trim() || null,
                earningsRange: earningsRange.trim() || null,
              });

              try {
                await notifySellerIntakeByEmail({ lead });
              } catch (err: any) {
                Alert.alert('Saved, but could not notify', err?.message ?? 'The lead was saved on this device, but email notification failed.');
              }

              setSubmitted(true);
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </View>
      </ScrollView>
    </View>
  );
}

function ChoiceGroup<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  options: readonly T[];
  value: T | null;
  onChange: (next: T) => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const textColor = Colors[theme].text;

  return (
    <View style={[styles.group, { borderColor }]}>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupTitle, { color: textColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.groupSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.pillsWrap}>
        {options.map((opt) => (
          <Pill key={opt} label={opt} selected={value === opt} onPress={() => onChange(opt)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: 10,
  },
  container: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: 10,
  },
  form: { gap: 14, marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.25, marginVertical: 6 },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ui.radius.md,
    padding: 12,
    gap: 10,
  },
  groupHeader: { gap: 2 },
  groupTitle: { fontSize: 14, fontWeight: '900' },
  groupSubtitle: { fontSize: 12, fontWeight: '700', opacity: 0.65 },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  surgeriesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  surgeriesValue: {
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surgeriesValueText: { fontSize: 16, fontWeight: '900' },
  groupHint: { fontSize: 12, fontWeight: '600', opacity: 0.6 },
});

