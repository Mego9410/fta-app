import { Link, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import type { Listing } from '@/src/domain/types';
import { listListings, setListingStatus } from '@/src/data/listingsRepo';
import { setAdminForceLoginNextOpenEnabled, setAdminForceOnboardingNextOpenEnabled } from '@/src/data/onboardingLocalRepo';
import { importFtaPracticesForSale } from '@/src/data/importers/ftaPracticesForSale';
import { hydrateAdminSession, isAdminAuthed, setAdminAuthed } from '@/src/ui/admin/adminSession';
import { getAdminAccess } from '@/src/supabase/admin';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { ListingCard } from '@/src/ui/components/ListingCard';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

export default function AdminHomeScreen() {
  const [authed, setAuthedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [mode, setMode] = useState<'local' | 'supabase'>('local');
  const [notAdmin, setNotAdmin] = useState(false);

  const [showArchived, setShowArchived] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(true);

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

  const status: Listing['status'] = showArchived ? 'archived' : 'active';
  const query = useMemo(
    () => ({ status, keyword: keyword.trim() ? keyword.trim() : undefined }),
    [status, keyword],
  );

  const load = useCallback(async () => {
    const rows = await listListings(query);
    setListings(rows);
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
      return (
        <View style={styles.container}>
          <ScreenHeader
            mode="tabs"
            fallbackHref="/profile"
            title="Admin"
            subtitle={notAdmin ? 'You are signed in but not an admin.' : 'Sign in with an admin account.'}
            style={{ paddingHorizontal: 0 }}
          />

          {authEmail ? <Text style={styles.hint}>Signed in as: {authEmail}</Text> : null}

          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/login')}>
            <Text style={styles.btnPrimaryText}>Sign in</Text>
          </Pressable>

          {authEmail ? (
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={async () => {
                try {
                  const supabase = requireSupabase();
                  await supabase.auth.signOut();
                } finally {
                  setAuthedState(false);
                  setAuthEmail('');
                  setNotAdmin(false);
                }
              }}>
              <Text style={styles.btnGhostText}>Sign out</Text>
            </Pressable>
          ) : null}
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
        subtitle="Create, edit, and archive listings."
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

        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Search listings..."
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show archived</Text>
          <Switch value={showArchived} onValueChange={setShowArchived} />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Replace listings on import</Text>
          <Switch value={replaceOnImport} onValueChange={setReplaceOnImport} />
        </View>

        <View style={styles.actionsRow}>
          <Link href="/profile/admin/new" asChild>
            <Pressable style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>Create Listing</Text>
            </Pressable>
          </Link>
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
                const result = await importFtaPracticesForSale({ replaceExisting: replaceOnImport });
                Alert.alert('Import complete', `Imported ${result.imported} listings.`);
                await load();
              } catch (e) {
                Alert.alert('Import failed', 'Could not import listings from the website. Try again.');
              } finally {
                setImporting(false);
              }
            }}>
            <Text style={styles.btnPrimaryText}>{importing ? 'Importing…' : 'Import from Website'}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.adminCardWrap}>
            <ListingCard
              listing={item}
              isSaved={false}
              onPress={() =>
                router.push({
                  pathname: '/profile/admin/edit/[id]',
                  params: { id: item.id },
                })
              }
              onToggleSaved={() =>
                router.push({
                  pathname: '/profile/admin/edit/[id]',
                  params: { id: item.id },
                })
              }
            />

            <View style={styles.adminRow}>
              <Pressable
                style={[styles.btn, styles.btnGhost, styles.half]}
                onPress={() =>
                  router.push({
                    pathname: '/profile/admin/edit/[id]',
                    params: { id: item.id },
                  })
                }>
                <Text style={styles.btnGhostText}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnGhost, styles.half]}
                onPress={async () => {
                  if (!isAdminAuthed()) {
                    await hydrateAdminSession();
                    if (!isAdminAuthed()) {
                      router.replace('/profile/admin');
                      return;
                    }
                  }
                  await setListingStatus(item.id, item.status === 'active' ? 'archived' : 'active');
                  await load();
                }}>
                <Text style={styles.btnGhostText}>{item.status === 'active' ? 'Archive' : 'Unarchive'}</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No listings</Text>
            <Text style={styles.emptyBody}>
              {showArchived ? 'No archived listings.' : 'Create your first listing to get started.'}
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

