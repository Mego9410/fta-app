import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getAdminAccess } from '@/src/supabase/admin';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

type LeadRow = {
  id: string;
  type: 'buyerInquiry' | 'sellerIntake';
  listing_id: string | null;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  callback_window: string | null;
  message: string | null;
  industry: string | null;
  location: string | null;
  income_mix: string | null;
  practice_type: string | null;
  surgeries_count: number | null;
  tenure: string | null;
  readiness: string | null;
  timeline: string | null;
  revenue_range: string | null;
  earnings_range: string | null;
  created_at: string;
};

type LeadTypeFilter = 'all' | LeadRow['type'];

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function AdminLeadsScreen() {
  const theme = useColorScheme() ?? 'light';
  const [ready, setReady] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LeadTypeFilter>('all');
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          Alert.alert('Supabase not configured', 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
          router.replace('/profile');
          return;
        }

        const access = await getAdminAccess();
        if (cancelled) return;
        if (access.status !== 'admin') {
          router.replace('/profile');
          return;
        }
        setReady(true);
      } catch (e: any) {
        Alert.alert('Admin check failed', e?.message ?? String(e));
        router.replace('/profile');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    const supabase = requireSupabase();
    let q = supabase
      .from('leads')
      .select(
        'id, type, listing_id, user_id, name, email, phone, callback_window, message, industry, location, income_mix, practice_type, surgeries_count, tenure, readiness, timeline, revenue_range, earnings_range, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeFilter !== 'all') {
      q = q.eq('type', typeFilter);
    }

    const { data, error } = await q;
    if (error) throw error;
    setRows((data as any) ?? []);
  }, [typeFilter]);

  useEffect(() => {
    if (!ready) return;
    load().catch((e) => Alert.alert('Failed to load leads', e?.message ?? String(e)));
  }, [ready, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const filteredTitle = useMemo(() => {
    if (typeFilter === 'all') return 'Leads';
    return typeFilter === 'buyerInquiry' ? 'Leads: Enquiries' : 'Leads: Seller intake';
  }, [typeFilter]);

  if (!ready) {
    return (
      <View style={styles.container}>
        <ScreenHeader mode="tabs" fallbackHref="/profile/admin" title="Leads" subtitle="Loading…" style={{ paddingHorizontal: 0 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        mode="tabs"
        fallbackHref="/profile/admin"
        title={filteredTitle}
        subtitle="Recent submissions (Supabase)."
        style={{ paddingHorizontal: 0, paddingBottom: 6 }}
      />

      <View style={styles.filters}>
        <Pressable
          style={[styles.chip, typeFilter === 'all' && styles.chipActive]}
          onPress={() => setTypeFilter('all')}>
          <Text style={[styles.chipText, typeFilter === 'all' && styles.chipTextActive]}>All</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, typeFilter === 'buyerInquiry' && styles.chipActive]}
          onPress={() => setTypeFilter('buyerInquiry')}>
          <Text style={[styles.chipText, typeFilter === 'buyerInquiry' && styles.chipTextActive]}>Enquiries</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, typeFilter === 'sellerIntake' && styles.chipActive]}
          onPress={() => setTypeFilter('sellerIntake')}>
          <Text style={[styles.chipText, typeFilter === 'sellerIntake' && styles.chipTextActive]}>Seller intake</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Platform.OS === 'ios' ? Colors[theme].tint : undefined}
            colors={Platform.OS === 'android' ? [Colors[theme].tint] : undefined}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              const lines = [
                `Type: ${item.type}`,
                item.listing_id ? `Listing: ${item.listing_id}` : null,
                item.user_id ? `User: ${item.user_id}` : null,
                `Name: ${item.name}`,
                item.email ? `Email: ${item.email}` : null,
                item.phone ? `Phone: ${item.phone}` : null,
                item.callback_window ? `Callback window: ${item.callback_window}` : null,
                item.location ? `Location: ${item.location}` : null,
                item.income_mix ? `Income mix: ${item.income_mix}` : null,
                item.practice_type ? `Practice type: ${item.practice_type}` : null,
                typeof item.surgeries_count === 'number' ? `Surgeries: ${item.surgeries_count}` : null,
                item.tenure ? `Tenure: ${item.tenure}` : null,
                item.readiness ? `Readiness: ${item.readiness}` : null,
                item.timeline ? `Timeline: ${item.timeline}` : null,
                item.revenue_range ? `Revenue range: ${item.revenue_range}` : null,
                item.earnings_range ? `Earnings range: ${item.earnings_range}` : null,
                item.message ? `Message:\n${item.message}` : null,
                '',
                `Submitted: ${fmt(item.created_at)}`,
                `ID: ${item.id}`,
              ].filter(Boolean) as string[];
              Alert.alert('Lead', lines.join('\n'));
            }}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.type} • {fmt(item.created_at)}
            </Text>
            {(item.email || item.phone) && (
              <Text style={styles.cardBody}>
                {(item.email ?? '').trim()}
                {item.email && item.phone ? ' • ' : ''}
                {(item.phone ?? '').trim()}
              </Text>
            )}
            {item.listing_id ? <Text style={styles.cardBody}>Listing: {item.listing_id}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No leads</Text>
            <Text style={styles.emptyBody}>Try changing the filter, or pull to refresh.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    paddingTop: ui.layout.screenPaddingY,
    gap: 12,
  },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  chipActive: { backgroundColor: '#0f172a' },
  chipText: { fontSize: 13, fontWeight: '800', opacity: 0.85 },
  chipTextActive: { color: 'white', opacity: 1 },
  listContent: { paddingTop: 4, paddingBottom: 24, gap: 10 },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 2, fontSize: 12, fontWeight: '800', opacity: 0.65 },
  cardBody: { marginTop: 6, fontSize: 13, opacity: 0.8 },
  empty: { paddingTop: 24, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { opacity: 0.75 },
});

