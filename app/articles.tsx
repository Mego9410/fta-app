import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { ArticlePreview } from '@/src/data/webContent/articles';
import { fetchArticleDetail, fetchLatestArticlePreviews } from '@/src/data/webContent/articles';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { SearchBar } from '@/src/ui/components/SearchBar';
import { ui } from '@/src/ui/theme';

const READ_WPM = 220;

function estimateReadTimeMinutes(text: string, wpm = READ_WPM): number {
  const safe = (text ?? '').trim();
  if (!safe) return 1;
  const words = safe.split(/\s+/g).filter(Boolean).length;
  const minutes = words / Math.max(1, wpm);
  return Math.max(1, Math.round(minutes));
}

export default function ArticlesScreen() {
  const theme = useColorScheme() ?? 'light';
  const tabBarHeight = 66;
  const tabBarBottom = ui.spacing.md;
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)';
  const [rows, setRows] = useState<ArticlePreview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [readMinsByUrl, setReadMinsByUrl] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const items = await fetchLatestArticlePreviews({ limit: 30 });
    setRows(items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const urls = rows.map((r) => r.url).filter(Boolean);
    if (!urls.length) return;

    (async () => {
      for (const url of urls) {
        if (cancelled) return;
        if (readMinsByUrl[url] != null) continue;
        try {
          const detail = await fetchArticleDetail(url);
          const mins = estimateReadTimeMinutes(detail?.contentText ?? '');
          if (!cancelled) {
            setReadMinsByUrl((prev) => (prev[url] != null ? prev : { ...prev, [url]: mins }));
          }
        } catch {
          // Ignore per-item errors; we can still show title/date/excerpt.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally NOT depending on readMinsByUrl to avoid restarting the loop each time we set it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const hay = `${a.title ?? ''} ${a.excerpt ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, rows]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.url}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Platform.OS === 'ios' ? Colors[theme].tint : undefined}
            colors={Platform.OS === 'android' ? [Colors[theme].tint] : undefined}
          />
        }
        contentContainerStyle={{
          paddingBottom: bottomPad,
          paddingHorizontal: ui.layout.screenPaddingX,
          gap: 12,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              title="Articles"
              subtitle="Latest insights from Frank Taylor & Associates."
              fallbackHref="/(tabs)"
              style={{ paddingHorizontal: 0 }}
            />

            <SearchBar value={query} onChangeText={setQuery} placeholder="Search articles" />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/article', params: { url: item.url } })}
            style={[styles.card, { borderColor }]}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.metaRow}>
              {item.dateText ? <Text style={styles.metaText}>{item.dateText}</Text> : null}
              {readMinsByUrl[item.url] ? (
                <Text style={styles.metaText}>
                  {item.dateText ? ' • ' : ''}
                  {readMinsByUrl[item.url]} min read
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <FontAwesome name="chevron-right" size={14} color={iconColor} />
            </View>

            {item.excerpt ? (
              <Text style={styles.excerpt} numberOfLines={3}>
                {item.excerpt}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ paddingTop: 20, gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#000000' }}>{query.trim() ? 'No matches' : 'No articles found'}</Text>
            <Text style={{ opacity: 0.85, fontWeight: '600' }}>
              {query.trim() ? 'Try a different search.' : 'Pull to refresh.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  header: {
    gap: 12,
    paddingBottom: 8,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 14, fontWeight: '600', opacity: 0.85 },
  card: {
    borderRadius: ui.radius.md,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#000000' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '800', opacity: 0.85, color: '#000000' },
  excerpt: { fontSize: 14, fontWeight: '600', opacity: 0.85, marginTop: 6, color: '#000000' },
});

