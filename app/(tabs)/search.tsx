import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import type { Listing, SearchPreferences } from '@/src/domain/types';
import { listListings } from '@/src/data/listingsRepo';
import { getListingsSyncMeta, maybeSyncListingsFromWebsite } from '@/src/data/listingsSync';
import { isFavorite, toggleFavorite } from '@/src/data/favoritesRepo';
import { getSearchPreferences, setSearchPreferences } from '@/src/data/preferencesRepo';
import { ListingCard } from '@/src/ui/components/ListingCard';
import { SearchBar } from '@/src/ui/components/SearchBar';
import { Pill } from '@/src/ui/components/Pill';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { TabPageHeader } from '@/src/ui/components/TabPageHeader';
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
  const [syncLine, setSyncLine] = useState('');

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

  // Load defaults on mount and whenever the tab gains focus
  // This ensures defaults update when navigating back from profile settings
  useFocusEffect(
    useCallback(() => {
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
    }, [applyDefaults]),
  );

  useEffect(() => {
    const kw = typeof params.keyword === 'string' ? params.keyword : '';
    if (kw) setKeyword(kw);

    setPresetFeaturedOnly(params.featuredOnly === '1' || params.featuredOnly === 'true');
    setPresetConfidentialOnly(params.confidentialOnly === '1' || params.confidentialOnly === 'true');
    setPresetFinancingOnly(params.financingOnly === '1' || params.financingOnly === 'true');
  }, [params.confidentialOnly, params.featuredOnly, params.financingOnly, params.keyword]);

  const load = useCallback(async () => {
    await maybeSyncListingsFromWebsite();
    const rows = await listListings({ status: 'active' });
    setAllListings(rows);

    const pairs = await Promise.all(rows.map(async (l) => [l.id, await isFavorite(l.id)] as const));
    setSavedMap(Object.fromEntries(pairs));

    const meta = await getListingsSyncMeta();
    if (meta.lastAt) {
      const d = new Date(meta.lastAt);
      const dateText = Number.isNaN(d.getTime()) ? meta.lastAt : d.toLocaleString();
      setSyncLine(`Listings updated: ${dateText}`);
    } else {
      setSyncLine('');
    }

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
    const hasKeyword = keyword.trim().length > 0;
    
    return allListings.filter((l) => {
      if (presetFeaturedOnly && !l.featured) return false;
      if (presetConfidentialOnly && !l.confidential) return false;
      if (presetFinancingOnly && !l.financingAvailable) return false;

      if (hasKeyword) {
        // When keyword is present, ignore all other filters except keyword and presets
        const kw = keyword.trim().toLowerCase();
        const hay = `${l.title} ${l.industry} ${l.summary} ${l.locationCity} ${l.locationState}`.toLowerCase();
        if (!hay.includes(kw)) return false;
        return true;
      }

      // Apply all filters when no keyword is present
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

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Check if listings are under offer
      const aUnderOffer =
        (a.tags ?? []).some((t) => t.trim().toLowerCase() === 'under offer') ||
        /Status:\s*Under Offer/i.test(a.summary ?? '');
      const bUnderOffer =
        (b.tags ?? []).some((t) => t.trim().toLowerCase() === 'under offer') ||
        /Status:\s*Under Offer/i.test(b.summary ?? '');

      // Sort: non-under-offer first (0), then under-offer (1)
      if (aUnderOffer !== bUnderOffer) {
        return aUnderOffer ? 1 : -1;
      }

      // Within each group, sort by last 4 digits of reference number
      const extractRefCode = (listing: Listing): string | null => {
        if (listing.summary) {
          const m = listing.summary.match(/Ref\.\s*([A-Za-z0-9-]+)/i);
          const raw = m?.[1]?.trim() ?? null;
          if (!raw) return null;
          const cleaned = raw.replace(/\s*(virtual freehold|leasehold|freehold)\s*$/i, '').trim();
          return cleaned || null;
        }
        if (listing.id.startsWith('ftaweb-')) {
          return listing.id.replace('ftaweb-', '');
        }
        return null;
      };

      const getLast4Digits = (refCode: string | null): number => {
        if (!refCode) return 9999; // Put listings without ref codes at the end
        // Extract all digits from the ref code
        const digits = refCode.replace(/\D/g, '');
        if (digits.length === 0) return 9999;
        // Get last 4 digits, pad with zeros if needed
        const last4 = digits.slice(-4).padStart(4, '0');
        return parseInt(last4, 10);
      };

      const aRefCode = extractRefCode(a);
      const bRefCode = extractRefCode(b);
      const aLast4 = getLast4Digits(aRefCode);
      const bLast4 = getLast4Digits(bRefCode);

      return bLast4 - aLast4;
    });
  }, [filtered]);

  const availableCount = useMemo(() => {
    return filtered.filter((l) => isAvailablePractice(l)).length;
  }, [filtered]);

  useEffect(() => {
    setListings(sorted);
  }, [sorted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await maybeSyncListingsFromWebsite({ force: true });
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
      {refreshing && (
        <View style={[styles.refreshIndicator, { top: insets.top + 10 }]}>
          <ActivityIndicator size="small" color={Colors[theme].tint} />
        </View>
      )}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Platform.OS === 'ios' ? Colors[theme].tint : undefined}
            colors={Platform.OS === 'android' ? [Colors[theme].tint] : undefined}
          />
        }
        ListHeaderComponent={
          <>
            <TabPageHeader title="Search" subtitle={syncLine || 'Filter practices and listings.'} />
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

              {(() => {
                const filtersDisabled = keyword.trim().length > 0;
                return (
                  <>
                    <Group title="Number of surgeries (max)" disabled={filtersDisabled}>
                      <Text style={[styles.valueText, filtersDisabled && styles.disabledText]}>
                        {surgeriesValue}+
                      </Text>
                      <Slider
                        minimumValue={1}
                        maximumValue={Math.max(1, surgeriesMax)}
                        step={1}
                        value={surgeriesValue}
                        onValueChange={setSurgeriesValue}
                        minimumTrackTintColor={Colors[theme].tint}
                        maximumTrackTintColor={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}
                        thumbTintColor={Colors[theme].tint}
                        disabled={filtersDisabled}
                        style={[styles.slider, filtersDisabled && styles.sliderDisabled]}
                      />
                    </Group>

                    <Group title="Property type" disabled={filtersDisabled}>
                      <View style={styles.pillsRow}>
                        {PROPERTY_TYPE_OPTIONS.map((t) => (
                          <Pill
                            key={t}
                            label={t}
                            selected={propertyTypes.has(t)}
                            onPress={filtersDisabled ? () => {} : () => toggleSet(propertyTypes, setPropertyTypes, t)}
                            style={filtersDisabled ? styles.disabledPill : undefined}
                          />
                        ))}
                      </View>
                    </Group>

                    <Group title="Income type" disabled={filtersDisabled}>
                      <View style={styles.pillsRow}>
                        {INCOME_TYPE_OPTIONS.map((t) => (
                          <Pill
                            key={t}
                            label={t}
                            selected={incomeTypes.has(t)}
                            onPress={filtersDisabled ? () => {} : () => toggleSet(incomeTypes, setIncomeTypes, t)}
                            style={filtersDisabled ? styles.disabledPill : undefined}
                          />
                        ))}
                      </View>
                    </Group>

                    <Group title="Fee income (max)" disabled={filtersDisabled}>
                      <Text style={[styles.valueText, filtersDisabled && styles.disabledText]}>
                        {feeIncomeMax ? formatCurrency(feeIncomeValue) : '—'}
                      </Text>
                      <Slider
                        minimumValue={0}
                        maximumValue={Math.max(1, feeIncomeMax || 0)}
                        step={feeIncomeMax > 0 ? Math.max(1000, Math.round(feeIncomeMax / 200)) : 1}
                        value={feeIncomeValue}
                        onValueChange={setFeeIncomeValue}
                        minimumTrackTintColor={Colors[theme].tint}
                        maximumTrackTintColor={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.30)'}
                        thumbTintColor={Colors[theme].tint}
                        disabled={feeIncomeMax <= 0 || filtersDisabled}
                        style={[
                          styles.slider,
                          (feeIncomeMax <= 0 || filtersDisabled) && styles.sliderDisabled,
                        ]}
                      />
                    </Group>

                    <Group title="Location + radius" disabled={filtersDisabled}>
                      <TextInput
                        value={locationText}
                        onChangeText={setLocationText}
                        placeholder="City / Region (e.g., London)"
                        placeholderTextColor="#666666"
                        editable={!filtersDisabled}
                        style={[
                          styles.locationInput,
                          {
                            color: '#000000',
                            backgroundColor: '#E5E5E5',
                            borderColor: '#CCCCCC',
                          },
                          filtersDisabled && styles.disabledInput,
                        ]}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                      <Text style={[styles.helper, filtersDisabled && styles.disabledText]}>
                        If we recognize the location, radius uses distance; otherwise we fall back to text match.
                      </Text>
                      <Text style={[styles.valueText, filtersDisabled && styles.disabledText]}>
                        {radiusMiles} miles
                      </Text>
                      <Slider
                        minimumValue={1}
                        maximumValue={100}
                        step={1}
                        value={radiusMiles}
                        onValueChange={setRadiusMiles}
                        minimumTrackTintColor={Colors[theme].tint}
                        maximumTrackTintColor={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}
                        thumbTintColor={Colors[theme].tint}
                        disabled={filtersDisabled}
                        style={[styles.slider, filtersDisabled && styles.sliderDisabled]}
                      />
                    </Group>
                  </>
                );
              })()}

              <Text style={styles.resultsCount}>
                {listings.length} results • {availableCount} available
              </Text>
            </View>
          </>
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

function Group({
  title,
  children,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.group, disabled && styles.groupDisabled]}>
      <Text style={[styles.groupTitle, disabled && styles.disabledText]}>{title}</Text>
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
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  refreshIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    paddingVertical: 8,
  },
  listHeader: {
    paddingBottom: 0,
  },
  filters: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    color: '#000000',
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
    opacity: 0.85,
    color: '#000000',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.85,
    color: '#000000',
  },
  helper: {
    fontSize: 12,
    opacity: 0.80,
    color: '#000000',
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
    opacity: 0.85,
    marginTop: 2,
    color: '#000000',
  },
  slider: {
    height: 36,
    width: '100%',
  },
  sliderDisabled: {
    opacity: 0.5,
  },
  groupDisabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.4,
  },
  disabledPill: {
    opacity: 0.4,
  },
  disabledInput: {
    opacity: 0.5,
  },
  listContent: {
    paddingTop: 10,
  },
  empty: {
    paddingTop: 30,
    gap: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  emptyBody: { opacity: 0.85, color: '#000000' },
});

