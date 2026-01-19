import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import type { Listing, SearchPreferences } from '@/src/domain/types';
import { listListings } from '@/src/data/listingsRepo';
import { isFavorite, toggleFavorite } from '@/src/data/favoritesRepo';
import { getSearchPreferences, setSearchPreferences } from '@/src/data/preferencesRepo';
import { ListingCard } from '@/src/ui/components/ListingCard';
import { SearchBar } from '@/src/ui/components/SearchBar';
import { Pill } from '@/src/ui/components/Pill';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/src/ui/format';
import { lookupUkLocation } from '@/src/geo/ukLocations';
import { haversineMiles } from '@/src/geo/haversine';
import { ui } from '@/src/ui/theme';
import {
  getSurgeriesCountFromTags,
  INCOME_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  toggleSet,
} from '@/src/ui/searchFilters';

export default function SearchScreen() {
  const params = useLocalSearchParams<{
    keyword?: string;
    featuredOnly?: string;
    confidentialOnly?: string;
    financingOnly?: string;
  }>();
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const [keyword, setKeyword] = useState('');

  // Optional presets for deep-links from Home.
  const [presetFeaturedOnly, setPresetFeaturedOnly] = useState(false);
  const [presetConfidentialOnly, setPresetConfidentialOnly] = useState(false);
  const [presetFinancingOnly, setPresetFinancingOnly] = useState(false);

  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const [defaults, setDefaults] = useState<SearchPreferences | null>(null);
  const [defaultsStatus, setDefaultsStatus] = useState('');
  const [savingDefaults, setSavingDefaults] = useState(false);

  // Filters
  const [surgeriesMax, setSurgeriesMax] = useState(10);
  const [surgeriesValue, setSurgeriesValue] = useState(10);

  const [feeIncomeMax, setFeeIncomeMax] = useState(0);
  const [feeIncomeValue, setFeeIncomeValue] = useState(0);

  const [propertyTypes, setPropertyTypes] = useState<Set<string>>(new Set()); // Leasehold/Freehold/Virtual Freehold
  const [incomeTypes, setIncomeTypes] = useState<Set<string>>(new Set()); // NHS/Private/Mixed

  const [locationText, setLocationText] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(25);

  const locationCenter = useMemo(() => lookupUkLocation(locationText), [locationText]);

  const applyDefaults = useCallback((prefs: SearchPreferences) => {
    setKeyword(prefs.keyword ?? '');
    setSurgeriesValue(prefs.surgeriesMax ?? 10);
    setFeeIncomeValue(prefs.feeIncomeMax ?? 0);
    setPropertyTypes(new Set(prefs.propertyTypes ?? []));
    setIncomeTypes(new Set(prefs.incomeTypes ?? []));
    setLocationText(prefs.locationText ?? '');
    setRadiusMiles(prefs.radiusMiles ?? 25);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await getSearchPreferences();
      if (cancelled) return;
      setDefaults(prefs);
      if (prefs) applyDefaults(prefs);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDefaults]);

  useEffect(() => {
    const kw = typeof params.keyword === 'string' ? params.keyword : '';
    if (kw) setKeyword(kw);

    setPresetFeaturedOnly(params.featuredOnly === '1' || params.featuredOnly === 'true');
    setPresetConfidentialOnly(params.confidentialOnly === '1' || params.confidentialOnly === 'true');
    setPresetFinancingOnly(params.financingOnly === '1' || params.financingOnly === 'true');
  }, [params.confidentialOnly, params.featuredOnly, params.financingOnly, params.keyword]);

  const load = useCallback(async () => {
    const rows = await listListings({ status: 'active' });
    setAllListings(rows);

    const pairs = await Promise.all(rows.map(async (l) => [l.id, await isFavorite(l.id)] as const));
    setSavedMap(Object.fromEntries(pairs));

    // initialize slider ranges from data
    const surgeriesCounts = rows
      .map((l) => getSurgeriesCountFromTags(l.tags))
      .filter((n): n is number => n != null);
    const maxS = surgeriesCounts.length ? Math.max(...surgeriesCounts) : 10;
    setSurgeriesMax(Math.max(1, maxS));
    setSurgeriesValue((v) => (defaults ? Math.min(v, maxS) : maxS));

    const fees = rows.map((l) => l.grossRevenue ?? null).filter((n): n is number => n != null);
    const maxFee = fees.length ? Math.max(...fees) : 0;
    setFeeIncomeMax(maxFee);
    setFeeIncomeValue((v) => (defaults ? Math.max(0, Math.min(v, maxFee)) : maxFee));
  }, [defaults]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return allListings.filter((l) => {
      if (presetFeaturedOnly && !l.featured) return false;
      if (presetConfidentialOnly && !l.confidential) return false;
      if (presetFinancingOnly && !l.financingAvailable) return false;

      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const hay = `${l.title} ${l.industry} ${l.summary} ${l.locationCity} ${l.locationState}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }

      const surgeries = getSurgeriesCountFromTags(l.tags);
      if (surgeries != null && surgeries > surgeriesValue) return false;

      if (feeIncomeValue > 0) {
        const fee = l.grossRevenue ?? 0;
        if (fee > feeIncomeValue) return false;
      }

      if (propertyTypes.size > 0) {
        const tag = getPropertyType(l);
        if (!tag || !propertyTypes.has(tag)) return false;
      }

      if (incomeTypes.size > 0) {
        const tag = getIncomeType(l);
        if (!tag || !incomeTypes.has(tag)) return false;
      }

      if (locationText.trim()) {
        const loc = locationText.trim().toLowerCase();
        const hay = `${l.locationCity} ${l.locationState}`.toLowerCase();

        if (locationCenter) {
          // If we can resolve a center point, use radius filtering for listings with coords.
          if (l.latitude != null && l.longitude != null) {
            const d = haversineMiles(
              { latitude: locationCenter.latitude, longitude: locationCenter.longitude },
              { latitude: l.latitude, longitude: l.longitude },
            );
            if (d > radiusMiles) return false;
          } else {
            // Fallback to text match for listings without coords.
            if (!hay.includes(loc)) return false;
          }
        } else {
          // If we can't resolve the location text, keep the simple text filter.
          if (!hay.includes(loc)) return false;
        }
      }

      return true;
    });
  }, [
    allListings,
    keyword,
    presetFeaturedOnly,
    presetConfidentialOnly,
    presetFinancingOnly,
    surgeriesValue,
    feeIncomeValue,
    propertyTypes,
    incomeTypes,
    locationText,
    locationCenter,
    radiusMiles,
  ]);

  const availableCount = useMemo(() => {
    return filtered.filter((l) => isAvailablePractice(l)).length;
  }, [filtered]);

  useEffect(() => {
    setListings(filtered);
  }, [filtered]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onSaveAsDefault = useCallback(async () => {
    setSavingDefaults(true);
    setDefaultsStatus('');
    try {
      const prefs: SearchPreferences = {
        keyword,
        surgeriesMax: surgeriesValue,
        feeIncomeMax: feeIncomeValue,
        propertyTypes: Array.from(propertyTypes),
        incomeTypes: Array.from(incomeTypes),
        locationText,
        radiusMiles,
      };
      await setSearchPreferences(prefs);
      setDefaults(prefs);
      setDefaultsStatus('Saved as default.');
    } finally {
      setSavingDefaults(false);
    }
  }, [feeIncomeValue, incomeTypes, keyword, locationText, propertyTypes, radiusMiles, surgeriesValue]);

  const onResetToDefaults = useCallback(async () => {
    setDefaultsStatus('');
    const prefs = defaults ?? (await getSearchPreferences());
    if (!prefs) {
      setDefaultsStatus('No defaults saved yet.');
      return;
    }
    setDefaults(prefs);
    applyDefaults(prefs);
    setDefaultsStatus('Reset to defaults.');
  }, [applyDefaults, defaults]);

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: ui.layout.screenPaddingX,
            paddingBottom: bottomPad,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <Text style={styles.title}>Search</Text>
              <Text style={styles.subtitle}>Filter practices and listings.</Text>
            </View>

            <View style={styles.filters}>
              <SearchBar value={keyword} onChangeText={setKeyword} placeholder="Search…" />

              <View style={styles.defaultsRow}>
                <SecondaryButton
                  title="Reset to defaults"
                  onPress={onResetToDefaults}
                  disabled={savingDefaults}
                  style={styles.defaultsBtn}
                />
                <PrimaryButton
                  title="Save as default"
                  onPress={onSaveAsDefault}
                  disabled={savingDefaults}
                  style={styles.defaultsBtn}
                />
              </View>
              {defaultsStatus ? <Text style={styles.defaultsStatus}>{defaultsStatus}</Text> : null}

              <Group title="Number of surgeries (max)">
                <Text style={styles.valueText}>{surgeriesValue}+</Text>
                <Slider
                  minimumValue={1}
                  maximumValue={Math.max(1, surgeriesMax)}
                  step={1}
                  value={surgeriesValue}
                  onValueChange={setSurgeriesValue}
                  minimumTrackTintColor={Colors[theme].tint}
                  maximumTrackTintColor={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}
                  thumbTintColor={Colors[theme].tint}
                  style={styles.slider}
                />
              </Group>

              <Group title="Property type">
                <View style={styles.pillsRow}>
                  {PROPERTY_TYPE_OPTIONS.map((t) => (
                    <Pill
                      key={t}
                      label={t}
                      selected={propertyTypes.has(t)}
                      onPress={() => toggleSet(propertyTypes, setPropertyTypes, t)}
                    />
                  ))}
                </View>
              </Group>

              <Group title="Income type">
                <View style={styles.pillsRow}>
                  {INCOME_TYPE_OPTIONS.map((t) => (
                    <Pill
                      key={t}
                      label={t}
                      selected={incomeTypes.has(t)}
                      onPress={() => toggleSet(incomeTypes, setIncomeTypes, t)}
                    />
                  ))}
                </View>
              </Group>

              <Group title="Fee income (max)">
                <Text style={styles.valueText}>{feeIncomeMax ? formatCurrency(feeIncomeValue) : '—'}</Text>
                <Slider
                  minimumValue={0}
                  maximumValue={Math.max(1, feeIncomeMax || 0)}
                  step={feeIncomeMax > 0 ? Math.max(1000, Math.round(feeIncomeMax / 200)) : 1}
                  value={feeIncomeValue}
                  onValueChange={setFeeIncomeValue}
                  minimumTrackTintColor={Colors[theme].tint}
                  maximumTrackTintColor={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.30)'}
                  thumbTintColor={Colors[theme].tint}
                  disabled={feeIncomeMax <= 0}
                  style={[styles.slider, feeIncomeMax <= 0 && styles.sliderDisabled]}
                />
              </Group>

              <Group title="Location + radius">
                <TextInput
                  value={locationText}
                  onChangeText={setLocationText}
                  placeholder="City / Region (e.g., London)"
                  placeholderTextColor={theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)'}
                  style={[
                    styles.locationInput,
                    {
                      color: Colors[theme].text,
                      backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      borderColor: theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
                    },
                  ]}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <Text style={styles.helper}>
                  If we recognize the location, radius uses distance; otherwise we fall back to text match.
                </Text>
                <Text style={styles.valueText}>{radiusMiles} miles</Text>
                <Slider
                  minimumValue={1}
                  maximumValue={100}
                  step={1}
                  value={radiusMiles}
                  onValueChange={setRadiusMiles}
                  minimumTrackTintColor={Colors[theme].tint}
                  maximumTrackTintColor={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}
                  thumbTintColor={Colors[theme].tint}
                  style={styles.slider}
                />
              </Group>

              <Text style={styles.resultsCount}>
                {listings.length} results • {availableCount} available
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            isSaved={!!savedMap[item.id]}
            onPress={() =>
              router.push({
                pathname: '/listings/[id]',
                params: { id: item.id },
              })
            }
            onToggleSaved={async () => {
              const next = await toggleFavorite(item.id);
              setSavedMap((m) => ({ ...m, [item.id]: next }));
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyBody}>Try removing filters or searching a different keyword.</Text>
          </View>
        }
      />
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function getPropertyType(listing: Listing): string | null {
  const tags = listing.tags ?? [];
  if (tags.includes('Virtual Freehold')) return 'Virtual Freehold';
  if (tags.includes('Freehold')) return 'Freehold';
  if (tags.includes('Leasehold')) return 'Leasehold';
  const any = tags.find((t) => /freehold|leasehold/i.test(t));
  return any ?? null;
}

function getIncomeType(listing: Listing): string | null {
  const tags = listing.tags ?? [];
  if (tags.includes('NHS')) return 'NHS';
  if (tags.includes('Private')) return 'Private';
  if (tags.includes('Mixed')) return 'Mixed';
  return null;
}

function isAvailablePractice(listing: Listing): boolean {
  // Imported practices include “Status: X” in summary. If absent, treat as available.
  const m = listing.summary?.match(/Status:\s*([A-Za-z ]+)/i);
  const status = m?.[1]?.trim().toLowerCase();
  if (!status) return true;
  return status === 'available';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listHeader: {
    paddingBottom: 6,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 6,
    gap: 4,
  },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 14, opacity: 0.75, fontWeight: '600' },
  filters: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.9,
  },
  groupBody: {
    gap: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  defaultsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  defaultsBtn: {
    flex: 1,
  },
  defaultsStatus: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.7,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.75,
  },
  helper: {
    fontSize: 12,
    opacity: 0.65,
  },
  locationInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.75,
    marginTop: 2,
  },
  slider: {
    height: 36,
    width: '100%',
  },
  sliderDisabled: {
    opacity: 0.5,
  },
  listContent: {
    paddingTop: 10,
  },
  empty: {
    paddingTop: 30,
    gap: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { opacity: 0.75 },
});

