import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/Themed';
import { upsertListing } from '@/src/data/listingsRepo';
import { hydrateAdminSession, isAdminAuthed } from '@/src/ui/admin/adminSession';
import { getAdminAccess } from '@/src/supabase/admin';
import { isProdBuild, isSupabaseConfigured } from '@/src/supabase/client';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { blankDraft, draftToUpsertInput, validateDraft, type ListingDraft } from '@/src/ui/admin/listingForm';
import { ui } from '@/src/ui/theme';

function makeListingId() {
  return `fta-${Date.now().toString(16)}`;
}

export default function AdminNewListingScreen() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isProdBuild) {
        router.replace('/profile/admin');
        return;
      }
      if (!isSupabaseConfigured) {
        await hydrateAdminSession();
        if (!isAdminAuthed()) {
          router.replace('/profile/admin');
          return;
        }
      } else {
        const access = await getAdminAccess();
        if (access.status !== 'admin') {
          router.replace('/profile/admin');
          return;
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isProdBuild) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile/admin"
          title="New Listing"
          subtitle="Listing creation is disabled in production (listings are synced from the website)."
          style={{ paddingHorizontal: 0 }}
        />
      </View>
    );
  }

  const draftId = useMemo(() => makeListingId(), []);
  const [draft, setDraft] = useState<ListingDraft>(() => blankDraft(draftId));
  const [saving, setSaving] = useState(false);

  if (!ready) {
    return (
      <View style={styles.container}>
        <ScreenHeader mode="tabs" fallbackHref="/profile/admin" title="New Listing" subtitle="Loading…" style={{ paddingHorizontal: 0 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile/admin"
          title="New Listing"
          subtitle="Create a listing that looks like a real estate posting."
          style={{ paddingHorizontal: 0 }}
        />

        <View style={styles.form}>
          <Field
            label="Title *"
            value={draft.title}
            onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
            placeholder="e.g., Turnkey HVAC Services Company"
          />
          <Field
            label="Industry *"
            value={draft.industry}
            onChangeText={(v) => setDraft((d) => ({ ...d, industry: v }))}
            placeholder="e.g., Home Services"
          />
          <Field
            label="City *"
            value={draft.locationCity}
            onChangeText={(v) => setDraft((d) => ({ ...d, locationCity: v }))}
            placeholder="e.g., Dallas"
          />
          <Field
            label="State *"
            value={draft.locationState}
            onChangeText={(v) => setDraft((d) => ({ ...d, locationState: v.toUpperCase() }))}
            placeholder="TX"
          />
          <Field
            label="Asking Price *"
            value={draft.askingPrice}
            onChangeText={(v) => setDraft((d) => ({ ...d, askingPrice: v }))}
            placeholder="$1,250,000"
            keyboardType="number-pad"
          />
          <Field
            label="Gross Revenue"
            value={draft.grossRevenue}
            onChangeText={(v) => setDraft((d) => ({ ...d, grossRevenue: v }))}
            placeholder="$2,400,000"
            keyboardType="number-pad"
          />
          <Field
            label="Cash Flow"
            value={draft.cashFlow}
            onChangeText={(v) => setDraft((d) => ({ ...d, cashFlow: v }))}
            placeholder="$410,000"
            keyboardType="number-pad"
          />
          <Field
            label="Year Established"
            value={draft.yearEstablished}
            onChangeText={(v) => setDraft((d) => ({ ...d, yearEstablished: v }))}
            placeholder="2008"
            keyboardType="number-pad"
          />
          <Field
            label="Employees Range"
            value={draft.employeesRange}
            onChangeText={(v) => setDraft((d) => ({ ...d, employeesRange: v }))}
            placeholder="10-25"
          />
          <Field
            label="Summary *"
            value={draft.summary}
            onChangeText={(v) => setDraft((d) => ({ ...d, summary: v }))}
            placeholder="A few high-level highlights..."
            multiline
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Featured</Text>
            <Switch value={draft.featured} onValueChange={(v) => setDraft((d) => ({ ...d, featured: v }))} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Confidential</Text>
            <Switch
              value={draft.confidential}
              onValueChange={(v) => setDraft((d) => ({ ...d, confidential: v }))}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Financing Available</Text>
            <Switch
              value={draft.financingAvailable}
              onValueChange={(v) => setDraft((d) => ({ ...d, financingAvailable: v }))}
            />
          </View>

          <View style={styles.photos}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoRow}>
              {draft.photos.map((uri) => (
                <Pressable
                  key={uri}
                  onPress={() => setDraft((d) => ({ ...d, photos: d.photos.filter((p) => p !== uri) }))}
                  style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} />
                  <View style={styles.photoRemove}>
                    <Text style={styles.photoRemoveText}>Remove</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <SecondaryButton
              title="Add Photo"
              onPress={async () => {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                  Alert.alert('Permission needed', 'Please allow photo library access to add images.');
                  return;
                }
                const res = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.85,
                });
                if (res.canceled) return;
                const uri = res.assets?.[0]?.uri;
                if (!uri) return;
                setDraft((d) => ({ ...d, photos: [...d.photos, uri] }));
              }}
            />
          </View>

          <PrimaryButton
            title={saving ? 'Saving…' : 'Save Listing'}
            disabled={saving}
            onPress={async () => {
              const error = validateDraft(draft);
              if (error) {
                Alert.alert('Fix required', error);
                return;
              }
              setSaving(true);
              try {
                await upsertListing(draftToUpsertInput(draft));
                router.replace({
                  pathname: '/profile/admin/edit/[id]',
                  params: { id: draft.id },
                });
              } finally {
                setSaving(false);
              }
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: 10,
  },
  scroll: {
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingBottom: 30,
    gap: 10,
  },
  form: { gap: 14, marginTop: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 15, fontWeight: '700', opacity: 0.85 },
  photos: { gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 110, height: 80, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  photoRemoveText: { color: 'white', fontSize: 12, fontWeight: '800' },
});

