import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { LINKS } from '@/constants/Links';
import { clearProfileSettings, getProfileSettings, setProfileSettings } from '@/src/data/profileSettingsRepo';
import type { ProfileSettings } from '@/src/domain/types';
import { getAdminAccess } from '@/src/supabase/admin';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
import { getUserPreferences, upsertUserPreferences } from '@/src/supabase/profileRepo';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { TabPageHeader } from '@/src/ui/components/TabPageHeader';
import { ui } from '@/src/ui/theme';

export default function ProfileHomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [statusText, setStatusText] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await getProfileSettings();
    setSettings(s);

    // Check if user is signed in and sync email preferences from Supabase
    if (isSupabaseConfigured) {
      try {
        const supabase = requireSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        setHasSession(!!session);

        // Load email notification preference from Supabase if signed in
        if (session) {
          try {
            const prefs = await getUserPreferences(session.user.id);
            if (prefs) {
              setSettings((prev) => ({
                ...(prev ?? s),
                emailNotifications: prefs.email_notifications_enabled ?? true,
              }));
              // Sync to local storage
              await setProfileSettings({
                ...(s ?? { pushNewListings: true, pushSavedActivity: true, marketingEmails: false, emailNotifications: true }),
                emailNotifications: prefs.email_notifications_enabled ?? true,
              });
            }
          } catch (e) {
            console.warn('Failed to load email preferences from Supabase', e);
          }

          // Check admin access
          try {
            const adminAccess = await getAdminAccess();
            setIsAdmin(adminAccess.status === 'admin');
          } catch (e) {
            console.warn('Failed to check admin access', e);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      } catch {
        setHasSession(false);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const update = useCallback(async (patch: Partial<ProfileSettings>) => {
    setStatusText('');
    setSettings((prev) => {
      const next = {
        ...(prev ?? { pushNewListings: true, pushSavedActivity: true, marketingEmails: false, emailNotifications: true }),
        ...patch,
      };
      // fire-and-forget persistence; UI stays snappy
      void setProfileSettings(next);

      // If emailNotifications changed and user is signed in, sync to Supabase
      if (patch.emailNotifications !== undefined && isSupabaseConfigured) {
        (async () => {
          try {
            const supabase = requireSupabase();
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (session) {
              await upsertUserPreferences(session.user.id, {
                email_notifications_enabled: patch.emailNotifications,
              });
            }
          } catch (e) {
            console.warn('Failed to sync email preferences to Supabase', e);
          }
        })();
      }

      return next;
    });
    setStatusText('Saved.');
  }, []);

  const onClearSettings = useCallback(async () => {
    await clearProfileSettings();
    const s = await getProfileSettings();
    setSettings(s);
    setStatusText('Reset profile settings.');
  }, []);

  const cardBg = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const border = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  return (
    <View style={styles.wrapper}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Platform.OS === 'ios' ? Colors[theme].tint : undefined}
            colors={Platform.OS === 'android' ? [Colors[theme].tint] : undefined}
          />
        }
        contentContainerStyle={[
          styles.container,
          { paddingTop: 0, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}>
      <TabPageHeader title="Profile" subtitle="Manage your settings and defaults." />

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Defaults</Text>
        <Row
          title="Search preferences"
          subtitle="Set default filters for Search"
          icon="sliders"
          onPress={() => router.push('/profile/search-preferences')}
        />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Row
          title="Your details"
          subtitle="View the details you've provided"
          icon="id-card"
          onPress={() => router.push('/profile/details')}
        />
        {hasSession && (
          <Row
            title="My submissions"
            subtitle="View your enquiries and seller intakes"
            icon="list"
            onPress={() => router.push('/profile/my-submissions')}
          />
        )}
        {hasSession && (
          <Pressable
            onPress={async () => {
              try {
                if (isSupabaseConfigured) {
                  const supabase = requireSupabase();
                  await supabase.auth.signOut();
                }
                router.replace('/(tabs)');
              } catch (e: any) {
                Alert.alert('Sign out failed', e?.message ?? String(e));
              }
            }}
            style={[styles.row, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                <FontAwesome name="sign-out" size={16} color={theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Sign out</Text>
                <Text style={styles.rowSubtitle}>Sign out of your account</Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'} />
          </Pressable>
        )}
      </View>

      {isAdmin && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <Row
            title="Admin controls"
            subtitle="Sync listings and view leads"
            icon="lock"
            onPress={() => router.push('/profile/admin')}
          />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Help & legal</Text>
        <Row
          title="Contact support"
          subtitle="Get help or ask a question"
          icon="envelope"
          onPress={() => router.push({ pathname: '/web', params: { url: LINKS.supportSite, title: 'Support' } } as any)}
        />
        <Row
          title="Privacy policy"
          subtitle="How we use your data"
          icon="shield"
          onPress={() => router.push({ pathname: '/web', params: { url: LINKS.privacy, title: 'Privacy policy' } } as any)}
        />
        <Row
          title="Terms"
          subtitle="Terms and conditions"
          icon="file-text"
          onPress={() => router.push({ pathname: '/web', params: { url: LINKS.terms, title: 'Terms' } } as any)}
        />
        <Row
          title="Delete account"
          subtitle="Request account deletion"
          icon="trash"
          onPress={() => router.push('/profile/delete-account')}
        />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ToggleRow
          title="New listings"
          subtitle="Get notified when new listings appear"
          value={!!settings?.pushNewListings}
          onValueChange={(v) => {
            update({ pushNewListings: v });
            // If disabling new listings, also disable search filters
            if (!v) {
              update({ useSearchFilters: false });
            }
          }}
        />
        <ToggleRow
          title="Use search filters"
          subtitle="Only notify about listings matching your search criteria"
          value={!!settings?.useSearchFilters}
          disabled={!settings?.pushNewListings}
          onValueChange={(v) => update({ useSearchFilters: v })}
        />
        <ToggleRow
          title="Saved activity"
          subtitle="Updates on saved listings (coming soon)"
          value={!!settings?.pushSavedActivity}
          onValueChange={(v) => update({ pushSavedActivity: v })}
        />
        <ToggleRow
          title="Email updates"
          subtitle="Receive email notifications about your submissions"
          value={settings?.emailNotifications !== undefined ? !!settings.emailNotifications : true}
          onValueChange={(v) => update({ emailNotifications: v })}
        />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <ToggleRow
          title="Marketing emails"
          subtitle="Opt in to marketing emails (future account feature)"
          value={!!settings?.marketingEmails}
          onValueChange={(v) => update({ marketingEmails: v })}
        />
      </View>

      <View style={styles.actions}>
        <SecondaryButton title="Reset profile settings" onPress={onClearSettings} />
        {statusText ? <Text style={styles.status}>{statusText}</Text> : null}
        <Text style={styles.helper}>
          Note: push notifications require additional setup (APNs/FCM). Email enquiries work now.
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

function Row({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)';
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderColor }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
          <FontAwesome name={icon} size={16} color={iconColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <FontAwesome name="chevron-right" size={16} color={iconColor} />
    </Pressable>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const trackColor = { false: theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)', true: Colors[theme].tint };
  const thumbColor = '#fff';
  const opacity = disabled ? 0.5 : 1;
  return (
    <View style={[styles.toggleRow, { opacity }]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={trackColor} thumbColor={thumbColor} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '900', opacity: 0.75, textTransform: 'uppercase' },
  row: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSubtitle: { fontSize: 13, opacity: 0.7, fontWeight: '600' },
  toggleRow: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: { gap: 10, paddingTop: 4 },
  status: { fontSize: 13, fontWeight: '700', opacity: 0.75 },
  helper: { fontSize: 12, opacity: 0.65, fontWeight: '600' },
});

