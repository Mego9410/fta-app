import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/Themed';
import type { Listing } from '@/src/domain/types';
import { getListingById, setListingStatus, upsertListing } from '@/src/data/listingsRepo';
import { hydrateAdminSession, isAdminAuthed } from '@/src/ui/admin/adminSession';
import { Field } from '@/src/ui/components/Field';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { draftToUpsertInput, listingToDraft, validateDraft, type ListingDraft } from '@/src/ui/admin/listingForm';
import { ui } from '@/src/ui/theme';

export default function AdminEditListingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';

  const [ready, setReady] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateAdminSession();
      if (!isAdminAuthed()) {
        router.replace('/profile/admin');
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const l = await getListingById(id);
      setListing(l);
      setDraft(l ? listingToDraft(l) : null);
    })();
  }, [id]);

  if (!id) {
    return (
      <View style={styles.container}>
        <ScreenHeader mode="tabs" fallbackHref="/profile/admin" title="Edit Listing" subtitle="Missing id." style={{ paddingHorizontal: 0 }} />
      </View>
    );
  }

  if (!ready || !draft || !listing) {
    return (
      <View style={styles.container}>
        <ScreenHeader mode="tabs" fallbackHref="/profile/admin" title="Edit Listing" subtitle="Loading…" style={{ paddingHorizontal: 0 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile/admin"
          title="Edit Listing"
          subtitle={`ID: ${listing.id}`}
          style={{ paddingHorizontal: 0 }}
        />

        <View style={styles.form}>
          <Field label="Title *" value={draft.title} onChangeText={(v) => setDraft((d) => (d ? { ...d, title: v } : d))} />
          <Field label="Industry *" value={draft.industry} onChangeText={(v) => setDraft((d) => (d ? { ...d, industry: v } : d))} />
          <Field label="City *" value={draft.locationCity} onChangeText={(v) => setDraft((d) => (d ? { ...d, locationCity: v } : d))} />
          <Field label="State *" value={draft.locationState} onChangeText={(v) => setDraft((d) => (d ? { ...d, locationState: v.toUpperCase() } : d))} />
          <Field label="Asking Price *" value={draft.askingPrice} onChangeText={(v) => setDraft((d) => (d ? { ...d, askingPrice: v } : d))} keyboardType="number-pad" />
          <Field label="Gross Revenue" value={draft.grossRevenue} onChangeText={(v) => setDraft((d) => (d ? { ...d, grossRevenue: v } : d))} keyboardType="number-pad" />
          <Field label="Cash Flow" value={draft.cashFlow} onChangeText={(v) => setDraft((d) => (d ? { ...d, cashFlow: v } : d))} keyboardType="number-pad" />
          <Field label="Year Established" value={draft.yearEstablished} onChangeText={(v) => setDraft((d) => (d ? { ...d, yearEstablished: v } : d))} keyboardType="number-pad" />
          <Field label="Employees Range" value={draft.employeesRange} onChangeText={(v) => setDraft((d) => (d ? { ...d, employeesRange: v } : d))} />
          <Field label="Summary *" value={draft.summary} onChangeText={(v) => setDraft((d) => (d ? { ...d, summary: v } : d))} multiline />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Featured</Text>
            <Switch value={draft.featured} onValueChange={(v) => setDraft((d) => (d ? { ...d, featured: v } : d))} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Confidential</Text>
            <Switch value={draft.confidential} onValueChange={(v) => setDraft((d) => (d ? { ...d, confidential: v } : d))} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Financing Available</Text>
            <Switch value={draft.financingAvailable} onValueChange={(v) => setDraft((d) => (d ? { ...d, financingAvailable: v } : d))} />
          </View>

          <View style={styles.photos}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoRow}>
              {draft.photos.map((uri) => (
                <Pressable
                  key={uri}
                  onPress={() => setDraft((d) => (d ? { ...d, photos: d.photos.filter((p) => p !== uri) } : d))}
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
                setDraft((d) => (d ? { ...d, photos: [...d.photos, uri] } : d));
              }}
            />
          </View>

          <PrimaryButton
            title={saving ? 'Saving…' : 'Save Changes'}
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
                const refreshed = await getListingById(id);
                setListing(refreshed);
                if (refreshed) setDraft(listingToDraft(refreshed));
              } finally {
                setSaving(false);
              }
            }}
          />

          <SecondaryButton
            title={listing.status === 'active' ? 'Archive Listing' : 'Unarchive Listing'}
            onPress={async () => {
              await hydrateAdminSession();
              if (!isAdminAuthed()) {
                router.replace('/profile/admin');
                return;
              }
              const nextStatus = listing.status === 'active' ? 'archived' : 'active';
              await setListingStatus(id, nextStatus);
              const refreshed = await getListingById(id);
              setListing(refreshed);
              if (refreshed) setDraft(listingToDraft(refreshed));
              if (nextStatus === 'archived') router.replace('/profile/admin');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingBottom: 30,
    gap: 10,
  },
  container: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
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
  photoRemove: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 4, alignItems: 'center' },
  photoRemoveText: { color: 'white', fontSize: 12, fontWeight: '800' },
});

