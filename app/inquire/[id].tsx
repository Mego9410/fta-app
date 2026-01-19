import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import type { Listing } from '@/src/domain/types';
import { getListingById } from '@/src/data/listingsRepo';
import { createLead } from '@/src/data/leadsRepo';
import { getLocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { notifyInquiryByEmail } from '@/src/notifications/inquiryEmail';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

export default function InquireScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';

  const [listing, setListing] = useState<Listing | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const didPrefill = useRef(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setListing(await getListingById(id));
    })();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only prefill once; never overwrite fields the user has already typed into.
      if (didPrefill.current) return;
      didPrefill.current = true;

      try {
        if (!isSupabaseConfigured) {
          const local = await getLocalOnboardingState();
          if (cancelled) return;
          if (!name.trim() && local.profile.fullName.trim()) setName(local.profile.fullName.trim());
          if (!phone.trim() && local.profile.phone.trim()) setPhone(local.profile.phone.trim());
          return;
        }

        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session || cancelled) return;

        const authEmail = session.user.email ?? '';
        if (!email.trim() && authEmail.trim()) setEmail(authEmail.trim());

        const userId = session.user.id;
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        if (!name.trim() && (profile?.full_name ?? '').trim()) setName((profile?.full_name ?? '').trim());
        if (!phone.trim() && (profile?.phone ?? '').trim()) setPhone((profile?.phone ?? '').trim());
      } catch (e) {
        // Prefill is best-effort; ignore failures (offline, not authenticated, etc.).
        console.warn('Failed to prefill enquiry form', e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit =
    !!listing && name.trim().length > 0 && (email.trim().length > 0 || phone.trim().length > 0);

  if (!id) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Request details"
          subtitle="Missing listing id."
          fallbackHref="/(tabs)"
          style={{ paddingHorizontal: 0 }}
        />
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Thanks — we got it"
          subtitle="A broker will follow up shortly."
          fallbackHref={`/listings/${id}`}
          style={{ paddingHorizontal: 0 }}
        />
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() =>
            router.replace({
              pathname: '/listings/[id]',
              params: { id },
            })
          }>
          <Text style={styles.btnPrimaryText}>Back to Listing</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.replace('/')}>
          <Text style={styles.btnGhostText}>Browse Listings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Request details"
          subtitle={listing ? `About: ${listing.title}` : 'Loading listing…'}
          fallbackHref={`/listings/${id}`}
          style={{ paddingHorizontal: 0 }}
        />

        <View style={styles.form}>
          <Field label="Name *">
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" />
          </Field>
          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="you@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="(555) 555-5555"
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="Message">
            <TextInput
              value={message}
              onChangeText={setMessage}
              style={[styles.input, styles.textarea]}
              placeholder="What questions do you have? Preferred time to connect?"
              multiline
            />
          </Field>

          <Pressable
            disabled={!canSubmit || submitting}
            style={[styles.btn, styles.btnPrimary, (!canSubmit || submitting) && styles.btnDisabled]}
            onPress={async () => {
              if (!canSubmit) {
                Alert.alert(
                  'Missing info',
                  listing
                    ? 'Please provide your name and either an email or phone number.'
                    : 'Please wait for the listing to load, then try again.',
                );
                return;
              }
              setSubmitting(true);
              try {
                const lead = await createLead({
                  type: 'buyerInquiry',
                  listingId: id,
                  name: name.trim(),
                  email: email.trim() || null,
                  phone: phone.trim() || null,
                  message: message.trim() || null,
                });

                try {
                  await notifyInquiryByEmail({ listing: listing!, lead });
                } catch (e) {
                  console.warn('Inquiry email notification failed', e);
                  Alert.alert(
                    'Enquiry submitted',
                    'We saved your enquiry, but could not send the email notification. If you don’t hear back soon, please contact us directly.',
                  );
                }
                setSubmitted(true);
              } finally {
                setSubmitting(false);
              }
            }}>
            <Text style={styles.btnPrimaryText}>{submitting ? 'Submitting…' : 'Submit Enquiry'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
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
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', opacity: 0.8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  btn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#0f172a' },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: '800' },
  btnGhost: { backgroundColor: 'rgba(0,0,0,0.06)' },
  btnGhostText: { fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
});

