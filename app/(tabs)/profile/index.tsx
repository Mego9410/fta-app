import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { clearProfileSettings, getProfileSettings, setProfileSettings } from '@/src/data/profileSettingsRepo';
import type { ProfileSettings } from '@/src/domain/types';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function ProfileHomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getProfileSettings();
      if (!cancelled) setSettings(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<ProfileSettings>) => {
    setStatusText('');
    setSettings((prev) => {
      const next = { ...(prev ?? { pushNewListings: true, pushSavedActivity: true, marketingEmails: false }), ...patch };
      // fire-and-forget persistence; UI stays snappy
      void setProfileSettings(next);
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
    <View
      style={[
        styles.container,
        { paddingTop: ui.layout.screenPaddingY + insets.top, paddingBottom: bottomPad },
      ]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your settings and defaults.</Text>
      </View>

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
          subtitle="View the details you’ve provided"
          icon="id-card"
          onPress={() => router.push('/profile/details')}
        />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Admin</Text>
        <Row
          title="Admin controls"
          subtitle="Create, edit, and archive listings"
          icon="lock"
          onPress={() => router.push('/profile/admin')}
        />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ToggleRow
          title="New listings"
          subtitle="Get notified when new listings appear"
          value={!!settings?.pushNewListings}
          onValueChange={(v) => update({ pushNewListings: v })}
        />
        <ToggleRow
          title="Saved activity"
          subtitle="Updates on saved listings (coming soon)"
          value={!!settings?.pushSavedActivity}
          onValueChange={(v) => update({ pushSavedActivity: v })}
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
          Note: account sign-in + real notifications will come when we add Supabase auth & push setup.
        </Text>
      </View>
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
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const trackColor = { false: theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)', true: Colors[theme].tint };
  const thumbColor = '#fff';
  return (
    <View style={styles.toggleRow}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={trackColor} thumbColor={thumbColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: ui.layout.screenPaddingY,
    paddingHorizontal: ui.layout.screenPaddingX,
    gap: 14,
  },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 14, opacity: 0.75, fontWeight: '600' },
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

