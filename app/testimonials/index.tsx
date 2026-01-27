import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { TestimonialPreview } from '@/src/data/webContent/testimonials';
import { fetchLatestTestimonials } from '@/src/data/webContent/testimonials';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

// TODO: Replace these with your exact Google rating + review count (and direct reviews link if you have it).
const GOOGLE_RATING = 4.8;
const GOOGLE_REVIEW_COUNT = 119;
const GOOGLE_REVIEWS_URL = 'https://www.google.com/search?q=Frank+Taylor+%26+Associates+reviews';

function StarRow({ rating }: { rating: number }) {
  const r = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  const full = Math.floor(r);
  const hasHalf = r - full >= 0.5;
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return 'star' as const;
    if (i === full && hasHalf) return 'star-half-o' as const;
    return 'star-o' as const;
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {stars.map((name, idx) => (
        <FontAwesome key={`${name}-${idx}`} name={name} size={14} color="#f6c343" />
      ))}
    </View>
  );
}

function GoogleRatingBadge({
  rating,
  reviewCount,
  onPress,
}: {
  rating: number;
  reviewCount: number;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.googleBadge, { borderColor }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#000000' }}>Google rating</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <StarRow rating={rating} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#000000' }}>{rating.toFixed(1)}</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: subtle }}>
              ({reviewCount.toLocaleString()} reviews)
            </Text>
          </View>
        </View>

        <FontAwesome name="angle-right" size={20} color={subtle} />
      </View>
    </Pressable>
  );
}

export default function TestimonialsScreen() {
  const theme = useColorScheme() ?? 'light';
  const tabBarHeight = 66;
  const tabBarBottom = ui.spacing.md;
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

  const [rows, setRows] = useState<TestimonialPreview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorText, setErrorText] = useState<string>('');

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorText('');
    try {
      // Use the same fetch path as Home (which is known to work reliably),
      // but request a larger batch for the full list screen.
      const items = await fetchLatestTestimonials({ limit: 200 });
      setRows(items);
      setStatus('idle');
    } catch (e: any) {
      setStatus('error');
      setErrorText(e?.message ? String(e.message) : 'Unknown error');
    }
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

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
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
          <View style={{ gap: 8 }}>
            <ScreenHeader
              title="Testimonials"
              subtitle="What clients say about working with FTA."
              fallbackHref="/(tabs)"
              style={{ paddingHorizontal: 0, paddingBottom: 0 }}
            />

            <GoogleRatingBadge
              rating={GOOGLE_RATING}
              reviewCount={GOOGLE_REVIEW_COUNT}
              onPress={() => router.push({ pathname: '/web', params: { url: GOOGLE_REVIEWS_URL, title: 'Google reviews' } })}
            />
            {status === 'loading' ? (
              <Text style={{ fontSize: 14, fontWeight: '700', opacity: 0.85 }}>Loading…</Text>
            ) : null}
            {status === 'error' ? (
              <View style={[styles.notice, { borderColor }]}>
                <Text style={{ fontSize: 16, fontWeight: '900' }}>Couldn’t load testimonials</Text>
                <Text style={{ marginTop: 6, fontSize: 13, fontWeight: '700', opacity: 0.85 }}>{errorText}</Text>
                <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '800', opacity: 0.85 }} onPress={load}>
                  Tap to retry
                </Text>
              </View>
            ) : null}
            {status !== 'loading' && status !== 'error' && rows.length ? (
              <Text style={{ fontSize: 12, fontWeight: '800', opacity: 0.6 }}>{rows.length} testimonials</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/testimonials/[id]',
                params: {
                  id: item.id,
                  author: item.author,
                  quote: item.quote.slice(0, 260),
                  url: item.url ?? '',
                },
              } as any)
            }
            style={[styles.card, { borderColor }]}>
            <Text style={styles.quote} numberOfLines={10}>
              “{item.quote}”
            </Text>
            <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={styles.author} numberOfLines={1}>
                {item.author}
              </Text>
              {item.dateText ? (
                <Text style={styles.date} numberOfLines={1}>
                  {item.dateText}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ paddingTop: 20, gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#000000' }}>No testimonials found</Text>
            <Text style={{ opacity: 0.85, fontWeight: '600' }}>Pull to refresh.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  googleBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
  },
  quote: { fontSize: 15, fontWeight: '700', color: '#000000' },
  author: { fontSize: 13, fontWeight: '900', color: '#000000' },
  date: { fontSize: 12, fontWeight: '800', opacity: 0.85 },
});

