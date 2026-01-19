import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { listListings } from '@/src/data/listingsRepo';
import { getSearchPreferences, setSearchPreferences } from '@/src/data/preferencesRepo';
import { getLocalOnboardingState, patchLocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import type { SearchPreferences } from '@/src/domain/types';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { SearchBar } from '@/src/ui/components/SearchBar';
import { Pill } from '@/src/ui/components/Pill';
import { formatCurrency } from '@/src/ui/format';
import {
  getSurgeriesCountFromTags,
  INCOME_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  toggleSet,
} from '@/src/ui/searchFilters';
import { ui } from '@/src/ui/theme';

function milesToKm(miles: number): number {
  const km = miles * 1.60934;
  return Math.max(1, Math.min(500, Math.round(km)));
}

export default function BuyerStep() {
  const theme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [keyword, setKeyword] = useState('');

  const [surgeriesMax, setSurgeriesMax] = useState(10);
  const [surgeriesValue, setSurgeriesValue] = useState(10);

  const [feeIncomeMax, setFeeIncomeMax] = useState(0);
  const [feeIncomeValue, setFeeIncomeValue] = useState(0);

  const [propertyTypes, setPropertyTypes] = useState<Set<string>>(new Set());
  const [incomeTypes, setIncomeTypes] = useState<Set<string>>(new Set());

  const [locationText, setLocationText] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(25);

  const loadSaved = useCallback(async () => {
    const saved = await getSearchPreferences();
    if (!saved) return;
    setKeyword(saved.keyword ?? '');
    setSurgeriesValue(saved.surgeriesMax ?? 10);
    setFeeIncomeValue(saved.feeIncomeMax ?? 0);
    setPropertyTypes(new Set(saved.propertyTypes ?? []));
    setIncomeTypes(new Set(saved.incomeTypes ?? []));
    setLocationText(saved.locationText ?? '');
    setRadiusMiles(saved.radiusMiles ?? 25);
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
        const local = await getLocalOnboardingState();
        if (!cancelled) {
          // Seed radius from onboarding if available; otherwise keep default/saved.
          if (local.preferences?.searchRadiusKm) {
            setRadiusMiles(Math.max(1, Math.min(100, Math.round(local.preferences.searchRadiusKm / 1.60934))));
          }
        }

        await loadSaved();
      } catch (e: any) {
        if (!cancelled) Alert.alert('Failed to load defaults', e?.message ?? String(e));
      } finally {
        if (!cancelled) {
          await loadRanges();
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRanges, loadSaved]);

  const feeStep = useMemo(() => {
    if (feeIncomeMax <= 0) return 1;
    return Math.max(1000, Math.round(feeIncomeMax / 200));
  }, [feeIncomeMax]);

  async function onContinue() {
    setBusy(true);
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

      const radiusKm = milesToKm(radiusMiles);

      if (!isSupabaseConfigured) {
        await patchLocalOnboardingState({
          step: 'preferences',
          preferences: {
            searchRadiusKm: radiusKm,
          },
        } as any);
      } else {
        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          router.replace('/(onboarding)/auth');
          return;
        }
        const userId = session.user.id;

        // Sync radius into user_preferences (km).
        const { error: prefsErr } = await supabase.from('user_preferences').upsert(
          {
            user_id: userId,
            search_radius_km: radiusKm,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (prefsErr) throw prefsErr;

        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ onboarding_step: 'preferences', updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (profileErr) throw profileErr;
      }

      router.push('/(onboarding)/preferences');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.pageLoading}>
        <Text style={styles.kicker}>Step 2 of 3</Text>
        <Text style={styles.title}>Search criteria</Text>
        <Text style={styles.subtitle}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Step 2 of 3</Text>
        <Text style={styles.title}>Search criteria</Text>
        <Text style={styles.subtitle}>Set defaults so Search is ready for you.</Text>

        <View style={styles.section}>
          <Group title="Keyword">
            <SearchBar value={keyword} onChangeText={setKeyword} placeholder="Optional keyword…" />
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
                <Pill key={t} label={t} selected={propertyTypes.has(t)} onPress={() => toggleSet(propertyTypes, setPropertyTypes, t)} />
              ))}
            </View>
          </Group>

          <Group title="Income type">
            <View style={styles.pillsRow}>
              {INCOME_TYPE_OPTIONS.map((t) => (
                <Pill key={t} label={t} selected={incomeTypes.has(t)} onPress={() => toggleSet(incomeTypes, setIncomeTypes, t)} />
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
            <PrimaryButton title={busy ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={busy} />
            <SecondaryButton title="Back" onPress={() => router.back()} disabled={busy} />
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
  pageLoading: { flex: 1, padding: ui.spacing.xl, gap: ui.spacing.sm, justifyContent: 'center' },
  content: {
    padding: ui.spacing.xl,
    paddingBottom: ui.spacing.xl + 20,
    gap: ui.spacing.sm,
  },
  kicker: { fontSize: 13, fontWeight: '800', opacity: 0.65 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { opacity: 0.75, marginBottom: ui.spacing.md },
  section: { gap: 14 },
  group: { gap: 8 },
  groupTitle: { fontSize: 14, fontWeight: '800', opacity: 0.9 },
  groupBody: { gap: 10 },
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
  slider: { height: 36, width: '100%' },
  sliderDisabled: { opacity: 0.5 },
  actions: { marginTop: ui.spacing.lg, gap: ui.spacing.sm },
});

