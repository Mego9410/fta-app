import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getListingById } from '@/src/data/listingsRepo';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

type LeadRow = {
  id: string;
  type: 'buyerInquiry' | 'sellerIntake';
  listing_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
};

type LeadTypeFilter = 'all' | LeadRow['type'];

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function extractRefCode(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const m = summary.match(/Ref\.\s*([A-Za-z0-9-]+)/i);
  const raw = m?.[1]?.trim() ?? null;
  if (!raw) return null;
  // Some sources append tenure immediately after the ref (e.g. `Ref. 14-96-3451Leasehold`).
  const cleaned = raw.replace(/\s*(virtual freehold|leasehold|freehold)\s*$/i, '').trim();
  return cleaned || null;
}

export default function MySubmissionsScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;

  const [ready, setReady] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LeadTypeFilter>('all');
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          if (!cancelled) {
            Alert.alert('Not available', 'My Submissions requires Supabase to be configured.');
            router.replace('/profile');
          }
          return;
        }

        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) {
            Alert.alert('Sign in required', 'Please sign in to view your submissions.');
            router.replace('/profile');
          }
          return;
        }
        setReady(true);
      } catch (e: any) {
        Alert.alert('Failed to load', e?.message ?? String(e));
        router.replace('/profile');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = requireSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return;

    const userId = session.user.id;
    let q = supabase
      .from('leads')
      .select('id, type, listing_id, name, email, phone, message, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (typeFilter !== 'all') {
      q = q.eq('type', typeFilter);
    }

    const { data, error } = await q;
    if (error) throw error;
    setRows((data as any) ?? []);
  }, [typeFilter]);

  useEffect(() => {
    if (!ready) return;
    load().catch((e) => Alert.alert('Failed to load submissions', e?.message ?? String(e)));
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
    if (typeFilter === 'all') return 'My Submissions';
    return typeFilter === 'buyerInquiry' ? 'My Enquiries' : 'My Seller Intakes';
  }, [typeFilter]);

  const cardBg = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const border = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const chipBg = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
  const chipActiveBg = theme === 'dark' ? 'rgba(255,255,255,0.20)' : '#0f172a';

  if (!ready) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile"
          title="My Submissions"
          subtitle="Loading…"
          style={{ paddingHorizontal: 0 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        mode="tabs"
        fallbackHref="/profile"
        title={filteredTitle}
        subtitle={`${rows.length} submission${rows.length !== 1 ? 's' : ''}`}
        style={{ paddingHorizontal: 0, paddingBottom: 6 }}
      />

      <View style={styles.filters}>
        <Pressable
          style={[styles.chip, { backgroundColor: chipBg }, typeFilter === 'all' && { backgroundColor: chipActiveBg }]}
          onPress={() => setTypeFilter('all')}>
          <Text style={[styles.chipText, typeFilter === 'all' && styles.chipTextActive]}>All</Text>
        </Pressable>
        <Pressable
          style={[
            styles.chip,
            { backgroundColor: chipBg },
            typeFilter === 'buyerInquiry' && { backgroundColor: chipActiveBg },
          ]}
          onPress={() => setTypeFilter('buyerInquiry')}>
          <Text style={[styles.chipText, typeFilter === 'buyerInquiry' && styles.chipTextActive]}>Enquiries</Text>
        </Pressable>
        <Pressable
          style={[
            styles.chip,
            { backgroundColor: chipBg },
            typeFilter === 'sellerIntake' && { backgroundColor: chipActiveBg },
          ]}
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
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
            onPress={async () => {
              const lines: string[] = [
                `Type: ${item.type === 'buyerInquiry' ? 'Enquiry' : 'Seller Intake'}`,
                `Submitted: ${fmt(item.created_at)}`,
                `Name: ${item.name}`,
              ];
              if (item.email) lines.push(`Email: ${item.email}`);
              if (item.phone) lines.push(`Phone: ${item.phone}`);
              if (item.message) lines.push(`\nMessage:\n${item.message}`);
              if (item.listing_id) {
                try {
                  const listing = await getListingById(item.listing_id);
                  if (listing) {
                    const refCode = extractRefCode(listing.summary);
                    if (refCode) {
                      lines.push(`\nReference: ${refCode}`);
                    } else {
                      lines.push(`\nListing: ${listing.title || item.listing_id}`);
                    }
                  } else {
                    lines.push(`\nListing ID: ${item.listing_id}`);
                  }
                } catch {
                  lines.push(`\nListing ID: ${item.listing_id}`);
                }
              }
              Alert.alert('Submission Details', lines.join('\n'));
            }}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardType}>
                {item.type === 'buyerInquiry' ? 'Enquiry' : 'Seller Intake'}
              </Text>
            </View>
            <Text style={styles.cardMeta}>{fmt(item.created_at)}</Text>
            {(item.email || item.phone) && (
              <Text style={styles.cardBody}>
                {[item.email, item.phone].filter(Boolean).join(' • ')}
              </Text>
            )}
            {item.listing_id && (
              <Pressable
                onPress={async () => {
                  try {
                    const listing = await getListingById(item.listing_id!);
                    if (listing) {
                      router.push({
                        pathname: '/listings/[id]',
                        params: { id: item.listing_id },
                      });
                    } else {
                      Alert.alert('Listing not found', 'This listing may have been removed.');
                    }
                  } catch (e: any) {
                    Alert.alert('Error', e?.message ?? String(e));
                  }
                }}>
                <Text style={[styles.cardLink, { color: theme === 'dark' ? '#60a5fa' : '#0f172a' }]}>View listing →</Text>
              </Pressable>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No submissions yet</Text>
            <Text style={styles.emptyBody}>
              {typeFilter === 'all'
                ? 'Submit an enquiry or seller intake to see it here.'
                : 'Try changing the filter, or submit a new enquiry or seller intake.'}
            </Text>
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
  },
  chipText: { fontSize: 13, fontWeight: '800', opacity: 0.85 },
  chipTextActive: { color: 'white', opacity: 1 },
  listContent: { paddingTop: 4, gap: 10 },
  card: {
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  cardType: {
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.7,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  cardMeta: { fontSize: 12, fontWeight: '800', opacity: 0.65 },
  cardBody: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  cardLink: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.8,
    marginTop: 4,
    color: '#0f172a',
  },
  empty: { paddingTop: 24, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { opacity: 0.75 },
});
