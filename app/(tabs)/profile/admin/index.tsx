import { Link, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    View
} from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { listListings } from '@/src/data/listingsRepo';
import { getListingsSyncMeta, maybeSyncListingsFromWebsite } from '@/src/data/listingsSync';
import { checkForNewListings } from '@/src/data/newListingsCheck';
import { setAdminForceLoginNextOpenEnabled, setAdminForceOnboardingNextOpenEnabled } from '@/src/data/onboardingLocalRepo';
import type { Listing } from '@/src/domain/types';
import { requestNotificationPermissions } from '@/src/notifications/notifications';
import { getAdminAccess } from '@/src/supabase/admin';
import { isProdBuild, isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { hydrateAdminSession, setAdminAuthed } from '@/src/ui/admin/adminSession';
import { ListingCard } from '@/src/ui/components/ListingCard';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

export default function AdminHomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const [authed, setAuthedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [mode, setMode] = useState<'local' | 'supabase'>('local');
  const [notAdmin, setNotAdmin] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [previewingNotification, setPreviewingNotification] = useState(false);
  const [syncLine, setSyncLine] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          setMode('local');
          const next = await hydrateAdminSession();
          if (!cancelled) setAuthedState(next);
          return;
        }

        setMode('supabase');
        const access = await getAdminAccess();
        if (cancelled) return;
        if (access.status === 'admin') {
          setAuthedState(true);
          setAuthEmail(access.email);
          setNotAdmin(false);
          return;
        }
        if (access.status === 'not_admin') {
          setAuthedState(false);
          setAuthEmail(access.email);
          setNotAdmin(true);
          return;
        }
        setAuthedState(false);
        setAuthEmail('');
        setNotAdmin(false);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Non-admins who land on admin: redirect to profile so they never see admin UI
  useEffect(() => {
    if (hydrated && mode === 'supabase' && !authed) {
      router.replace('/profile');
    }
  }, [hydrated, mode, authed]);

  const query = useMemo(
    () => ({ status: 'active' as const, keyword: keyword.trim() ? keyword.trim() : undefined }),
    [keyword],
  );

  const load = useCallback(async () => {
    const rows = await listListings(query);
    setListings(rows);

    const meta = await getListingsSyncMeta();
    if (meta.lastAt) {
      const d = new Date(meta.lastAt);
      const dateText = Number.isNaN(d.getTime()) ? meta.lastAt : d.toLocaleString();
      setSyncLine(`Last sync: ${dateText}`);
    } else {
      setSyncLine('');
    }
  }, [query]);

  useEffect(() => {
    if (!authed) return;
    load();
  }, [authed, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!hydrated) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          mode="tabs"
          fallbackHref="/profile"
          title="Admin"
          subtitle="Loading…"
          style={{ paddingHorizontal: 0 }}
        />
      </View>
    );
  }

  if (!authed) {
    if (mode === 'supabase') {
      // Non-admins: redirect to profile so they never see admin UI
      return (
        <View style={styles.container}>
          <ScreenHeader
            mode="tabs"
            fallbackHref="/profile"
            title="Admin"
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
          title="Admin"
          subtitle="Enter passcode to manage listings."
          style={{ paddingHorizontal: 0 }}
        />

        <TextInput
          value={passcode}
          onChangeText={setPasscode}
          placeholder="Passcode"
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.btn, styles.btnPrimary, passcode.trim().length === 0 && styles.btnDisabled]}
          disabled={passcode.trim().length === 0}
          onPress={async () => {
            // v1: simple local gate. Replace with secure storage / backend later.
            if (passcode.trim() === '1122') {
              await setAdminAuthed(true);
              setAuthedState(true);
            } else {
              setPasscode('');
            }
          }}>
          <Text style={styles.btnPrimaryText}>Unlock</Text>
        </Pressable>

        <Text style={styles.hint}>Default passcode (v1): 1122</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        mode="tabs"
        fallbackHref="/profile"
        title="Admin"
        subtitle={syncLine || 'Sync listings and view leads.'}
        style={{ paddingHorizontal: 0, paddingBottom: 6 }}
        right={
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={async () => {
              if (mode === 'supabase') {
                const supabase = requireSupabase();
                await supabase.auth.signOut();
              } else {
                await setAdminAuthed(false);
              }
              setAuthedState(false);
              setPasscode('');
              setAuthEmail('');
              setNotAdmin(false);
            }}>
            <Text style={styles.btnGhostText}>Lock</Text>
          </Pressable>
        }
      />

      <View style={styles.controls}>
        {!isProdBuild && (
          <>
            <View style={styles.onboardingAdmin}>
              <Text style={styles.sectionTitle}>Onboarding (Admin)</Text>
              <View style={styles.onboardingActions}>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={async () => {
                    await setAdminForceOnboardingNextOpenEnabled(true);
                    Alert.alert('Onboarding forced', 'On next app open, onboarding will be shown.');
                  }}>
                  <Text style={styles.btnPrimaryText}>Force on next open</Text>
                </Pressable>

                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.push('/(onboarding)/welcome')}>
                  <Text style={styles.btnGhostText}>Start now</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.onboardingAdmin}>
              <Text style={styles.sectionTitle}>Auth (Admin)</Text>
              <View style={styles.onboardingActions}>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={async () => {
                    await setAdminForceLoginNextOpenEnabled(true);
                    Alert.alert('Login forced', 'On next app open, the login screen will be shown.');
                  }}>
                  <Text style={styles.btnPrimaryText}>Force login on next open</Text>
                </Pressable>

                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.push('/login')}>
                  <Text style={styles.btnGhostText}>Open login now</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={styles.onboardingAdmin}>
          <Text style={styles.sectionTitle}>Match My Practice (Hidden Feature)</Text>
          <View style={styles.onboardingActions}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push('/swipe')}>
              <Text style={styles.btnPrimaryText}>Open Match My Practice</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.onboardingAdmin}>
          <Text style={styles.sectionTitle}>Notifications (Admin)</Text>
          <View style={styles.onboardingActions}>
            <Pressable
              disabled={testingNotifications || previewingNotification}
              style={[styles.btn, styles.btnPrimary, (testingNotifications || previewingNotification) && styles.btnDisabled]}
              onPress={async () => {
                setTestingNotifications(true);
                try {
                  // Request permissions if needed
                  const hasPermission = await requestNotificationPermissions();
                  if (!hasPermission) {
                    Alert.alert(
                      'Permissions needed',
                      'Please enable notification permissions in your device settings to test notifications.',
                    );
                    return;
                  }

                  // Force check for new listings and send notifications
                  await checkForNewListings();
                  Alert.alert('Notifications checked', 'Check for new listings completed. If there are new matching listings, notifications were sent.');
                } catch (e: any) {
                  Alert.alert('Error', `Failed to check notifications: ${e?.message || String(e)}`);
                } finally {
                  setTestingNotifications(false);
                }
              }}>
              <Text style={styles.btnPrimaryText}>{testingNotifications ? 'Checking…' : 'Force Check Notifications'}</Text>
            </Pressable>

            <Pressable
              disabled={testingNotifications || previewingNotification}
              style={[styles.btn, styles.btnGhost, (testingNotifications || previewingNotification) && styles.btnDisabled]}
              onPress={async () => {
                setPreviewingNotification(true);
                try {
                  // Request permissions if needed
                  const hasPermission = await requestNotificationPermissions();
                  if (!hasPermission) {
                    Alert.alert(
                      'Permissions needed',
                      'Please enable notification permissions in your device settings to preview notifications.',
                    );
                    return;
                  }

                  // Get the most recent listing based on reference number
                  const recentListings = await listListings({ status: 'active' });
                  if (recentListings.length === 0) {
                    Alert.alert('No listings', 'There are no active listings to preview. Sync listings first.');
                    return;
                  }

                  // Extract reference code from listing
                  const extractRefCode = (listing: Listing): string | null => {
                    // Extract from summary (e.g., "Ref. 14-96-3452")
                    if (listing.summary) {
                      const m = listing.summary.match(/Ref\.\s*([A-Za-z0-9-]+)/i);
                      const raw = m?.[1]?.trim() ?? null;
                      if (!raw) return null;
                      // Some sources append tenure immediately after the ref (e.g., `Ref. 14-96-3451Leasehold`).
                      const cleaned = raw.replace(/\s*(virtual freehold|leasehold|freehold)\s*$/i, '').trim();
                      return cleaned || null;
                    }
                    // Fallback: extract from ID if it's in the format ftaweb-REF
                    if (listing.id.startsWith('ftaweb-')) {
                      return listing.id.replace('ftaweb-', '');
                    }
                    return null;
                  };

                  // Get last 4 digits of reference number
                  const getLast4Digits = (refCode: string | null): number => {
                    if (!refCode) return -1; // Put listings without ref codes at the end
                    // Extract all digits from the ref code
                    const digits = refCode.replace(/\D/g, '');
                    if (digits.length === 0) return -1;
                    // Get last 4 digits, pad with zeros if needed
                    const last4 = digits.slice(-4).padStart(4, '0');
                    return parseInt(last4, 10);
                  };

                  // Sort by last 4 digits of reference number (highest first)
                  const sorted = [...recentListings].sort((a, b) => {
                    const aRefCode = extractRefCode(a);
                    const bRefCode = extractRefCode(b);
                    const aLast4 = getLast4Digits(aRefCode);
                    const bLast4 = getLast4Digits(bRefCode);
                    return bLast4 - aLast4; // Descending order
                  });

                  // Get the most recent listing (highest last 4 digits)
                  const mostRecent = sorted[0];
                  
                  // Format location and price like the actual notifications
                  const location = mostRecent.locationState?.toUpperCase() === 'UK' 
                    ? mostRecent.locationCity 
                    : `${mostRecent.locationCity}, ${mostRecent.locationState}`;
                  const price = new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: 'GBP',
                    maximumFractionDigits: 0,
                  }).format(mostRecent.askingPrice);
                  const body = `New Practice! - ${location}, ${price}`;

                  // Send a preview notification with actual listing data
                  const { scheduleNotification } = await import('@/src/notifications/notifications');
                  await scheduleNotification('Frank Taylor & Associates', body, {
                    listingId: mostRecent.id,
                    type: 'new_listing',
                  });
                  Alert.alert('Preview sent', 'A test notification has been sent with the most recent practice. Check your notification tray and tap it to view the listing.');
                } catch (e: any) {
                  Alert.alert('Error', `Failed to send preview notification: ${e?.message || String(e)}`);
                } finally {
                  setPreviewingNotification(false);
                }
              }}>
              <Text style={styles.btnGhostText}>{previewingNotification ? 'Sending…' : 'Preview Notification'}</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Search listings..."
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        <View style={styles.actionsRow}>
          <Link href="/profile/admin/leads" asChild>
            <Pressable style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>View Leads</Text>
            </Pressable>
          </Link>
          <Pressable
            disabled={importing}
            style={[styles.btn, styles.btnPrimary, importing && styles.btnDisabled]}
            onPress={async () => {
              setImporting(true);
              try {
                const result = await maybeSyncListingsFromWebsite({ force: true, throttleMs: 0 });
                if (result.status === 'ok') {
                  Alert.alert('Sync complete', `Imported ${result.imported} listings.`);
                } else if (result.status === 'skipped') {
                  Alert.alert('Up to date', 'Listings were recently synced.');
                } else {
                  Alert.alert('Sync failed', 'Could not sync listings from the website. Cached listings are unchanged.');
                }
                await load();
              } catch (e) {
                Alert.alert('Sync failed', 'Could not sync listings from the website. Try again.');
              } finally {
                setImporting(false);
              }
            }}>
            <Text style={styles.btnPrimaryText}>{importing ? 'Syncing…' : 'Sync from Website'}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={listings}
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
          <View style={styles.adminCardWrap}>
            <ListingCard
              listing={item}
              isSaved={false}
              onPress={() =>
                router.push({
                  pathname: '/listings/[id]',
                  params: { id: item.id },
                })
              }
              onToggleSaved={() => {}}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No listings</Text>
            <Text style={styles.emptyBody}>
              Listings are synced from the website. Tap “Sync from Website” to refresh.
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
  controls: {
    gap: 10,
  },
  onboardingAdmin: {
    gap: 10,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    opacity: 0.75,
    textTransform: 'uppercase',
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.85,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  adminCardWrap: {
    marginBottom: 14,
  },
  adminRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  half: { flex: 1 },
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
  hint: { fontSize: 12, opacity: 0.6 },
  empty: {
    paddingTop: 24,
    gap: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { opacity: 0.75 },
});

