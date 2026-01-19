import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { clearSearchPreferences, getSearchPreferences, setSearchPreferences } from '@/src/data/preferencesRepo';
import { listListings } from '@/src/data/listingsRepo';
import type { SearchPreferences } from '@/src/domain/types';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { SearchBar } from '@/src/ui/components/SearchBar';
import { Pill } from '@/src/ui/components/Pill';
import { formatCurrency } from '@/src/ui/format';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import {
  getSurgeriesCountFromTags,
  INCOME_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  toggleSet,
} from '@/src/ui/searchFilters';
import { ui } from '@/src/ui/theme';

export default function SearchPreferencesScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;

  const [keyword, setKeyword] = useState('');

  const [surgeriesMax, setSurgeriesMax] = useState(10);
  const [surgeriesValue, setSurgeriesValue] = useState(10);

  const [feeIncomeMax, setFeeIncomeMax] = useState(0);
  const [feeIncomeValue, setFeeIncomeValue] = useState(0);

  const [propertyTypes, setPropertyTypes] = useState<Set<string>>(new Set());
  const [incomeTypes, setIncomeTypes] = useState<Set<string>>(new Set());

  const [locationText, setLocationText] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(25);

  const [statusText, setStatusText] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const loadSaved = useCallback(async () => {
    const saved = await getSearchPreferences();
    if (!saved) return null;
    setKeyword(saved.keyword ?? '');
    setSurgeriesValue(saved.surgeriesMax ?? 10);
    setFeeIncomeValue(saved.feeIncomeMax ?? 0);
    setPropertyTypes(new Set(saved.propertyTypes ?? []));
    setIncomeTypes(new Set(saved.incomeTypes ?? []));
    setLocationText(saved.locationText ?? '');
    setRadiusMiles(saved.radiusMiles ?? 25);
    return saved;
  }, []);

  const loadRanges = useCallback(async () => {
    const rows = await listListings({ status: 'active' });

    const surgeriesCounts = rows
      .map((l) => getSurgeriesCountFromTags(l.tags))
      .filter((n): n is number => n != null);
    const maxS = surgeriesCounts.length ? Math.max(...surgeriesCounts) : 10;
    setSurgeriesMax(Math.max(1, maxS));
    setSurgeriesValue((v) => Math.min(Math.max(1, v), maxS));

    const fees = rows.map((l) => l.grossRevenue ?? null).filter((n): n is number => n != null);
    const maxFee = fees.length ? Math.max(...fees) : 0;
    setFeeIncomeMax(maxFee);
    setFeeIncomeValue((v) => Math.max(0, Math.min(v, maxFee)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSaved();
      } finally {
        if (!cancelled) {
          await loadRanges();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSaved, loadRanges]);

  const onSave = useCallback(async () => {
    setBusy(true);
    setStatusText('');
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
      setStatusText('Saved default search preferences.');
    } finally {
      setBusy(false);
    }
  }, [feeIncomeValue, incomeTypes, keyword, locationText, propertyTypes, radiusMiles, surgeriesValue]);

  const onClear = useCallback(async () => {
    setBusy(true);
    setStatusText('');
    try {
      await clearSearchPreferences();
      setKeyword('');
      setSurgeriesValue(surgeriesMax);
      setFeeIncomeValue(feeIncomeMax);
      setPropertyTypes(new Set());
      setIncomeTypes(new Set());
      setLocationText('');
      setRadiusMiles(25);
      setStatusText('Cleared saved defaults.');
    } finally {
      setBusy(false);
    }
  }, [feeIncomeMax, surgeriesMax]);

  const feeStep = useMemo(() => {
    if (feeIncomeMax <= 0) return 1;
    return Math.max(1000, Math.round(feeIncomeMax / 200));
  }, [feeIncomeMax]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: ui.layout.screenPaddingX,
            paddingBottom: bottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile"
          title="Default Search Preferences"
          subtitle="These will auto-populate the Search tab."
          style={{ paddingHorizontal: 0 }}
        />

        <View style={styles.section}>
          <Group title="Keyword">
            <SearchBar value={keyword} onChangeText={setKeyword} placeholder="Default keyword (optional)…" />
          </Group>

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
            step={feeStep}
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
            placeholder="Default location (e.g., London)"
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

          <View style={styles.actions}>
            <PrimaryButton title="Save defaults" onPress={onSave} disabled={busy} />
            <SecondaryButton title="Clear saved defaults" onPress={onClear} disabled={busy} />
            {statusText ? <Text style={styles.status}>{statusText}</Text> : null}
          </View>
        </View>
      </ScrollView>
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

const styles = StyleSheet.create({
  content: {
    paddingBottom: 26,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 6,
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 14, opacity: 0.75, fontWeight: '600' },
  section: {
    paddingTop: 8,
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
  valueText: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.75,
  },
  locationInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  slider: {
    height: 36,
    width: '100%',
  },
  sliderDisabled: {
    opacity: 0.5,
  },
  actions: {
    gap: 10,
    paddingTop: 6,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.75,
  },
});

