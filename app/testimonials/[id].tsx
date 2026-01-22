import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchAllTestimonials, type TestimonialPreview } from '@/src/data/webContent/testimonials';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

export default function TestimonialDetailScreen() {
  const { id, author, quote, url } = useLocalSearchParams<{ id?: string; author?: string; quote?: string; url?: string }>();
  const testimonialId = useMemo(() => (typeof id === 'string' ? id : ''), [id]);
  const hintAuthor = useMemo(() => (typeof author === 'string' ? author : ''), [author]);
  const hintQuote = useMemo(() => (typeof quote === 'string' ? quote : ''), [quote]);
  const hintUrl = useMemo(() => (typeof url === 'string' ? url : ''), [url]);
  const theme = useColorScheme() ?? 'light';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const chipBg = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  const [row, setRow] = useState<TestimonialPreview | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!testimonialId) return;
    setStatus('loading');
    try {
      const items = await fetchAllTestimonials();
      let found = items.find((t) => t.id === testimonialId) ?? null;

      // Fallback: sometimes IDs can drift if the source page changes slightly.
      // If we got author/quote hints in the route params, try a fuzzy match.
      if (!found && hintAuthor && hintQuote) {
        const qPrefix = hintQuote.slice(0, 80);
        found =
          items.find((t) => t.author === hintAuthor && t.quote.startsWith(qPrefix)) ??
          items.find((t) => t.author === hintAuthor && t.quote.includes(qPrefix.slice(0, 40))) ??
          null;
      }
      setRow(found);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [testimonialId, hintAuthor, hintQuote]);

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

  const title = row?.author ? `${row.author}` : hintAuthor ? `${hintAuthor}` : 'Testimonial';
  const effectiveUrl = row?.url ?? (hintUrl || null);

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Platform.OS === 'ios' ? Colors[theme].tint : undefined}
            colors={Platform.OS === 'android' ? [Colors[theme].tint] : undefined}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: ui.layout.screenPaddingX,
          paddingBottom: ui.spacing.lg,
          gap: 12,
        }}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.wrap}>
          <ScreenHeader
            title={title}
            subtitle={row?.dateText ?? undefined}
            fallbackHref="/testimonials"
            style={{ paddingHorizontal: 0 }}
            right={
              effectiveUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/web', params: { url: effectiveUrl ?? '', title } })}
                  style={[styles.openInline, { backgroundColor: chipBg }]}>
                  <Text style={styles.openInlineText}>Open original</Text>
                </Pressable>
              ) : null
            }
          />

          {status === 'loading' ? <Text style={styles.body}>Loading…</Text> : null}

          {status === 'error' ? (
            <View style={[styles.notice, { borderColor }]}>
              <Text style={styles.noticeTitle}>Couldn’t load this testimonial</Text>
              <Text style={styles.noticeBody}>You can try again.</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <SecondaryButton title="Try again" onPress={load} />
              </View>
            </View>
          ) : null}

          {status !== 'loading' && status !== 'error' && !row ? (
            <View style={[styles.notice, { borderColor }]}>
              <Text style={styles.noticeTitle}>Testimonial not found</Text>
              <Text style={styles.noticeBody}>
                It may have changed on the website. If you opened this from a cached card, we can still show the preview below.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <SecondaryButton title="Reload" onPress={load} />
                <SecondaryButton title="Back to testimonials" onPress={() => router.push({ pathname: '/testimonials' } as any)} />
              </View>
            </View>
          ) : null}

          {row ? (
            <View style={[styles.card, { borderColor }]}>
              <Text style={styles.quote}>“{row.quote}”</Text>
              <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={styles.author} numberOfLines={1}>
                  {row.author}
                </Text>
                {row.dateText ? (
                  <Text style={styles.date} numberOfLines={1}>
                    {row.dateText}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : !row && hintAuthor && hintQuote ? (
            <View style={[styles.card, { borderColor }]}>
              <Text style={styles.quote}>“{hintQuote}”</Text>
              <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={styles.author} numberOfLines={1}>
                  {hintAuthor}
                </Text>
              </View>
            </View>
          ) : null}

          {effectiveUrl ? (
            <View style={{ paddingTop: 2 }}>
              <SecondaryButton
                title="Open on website"
                onPress={() => router.push({ pathname: '/web', params: { url: effectiveUrl ?? '', title } })}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrap: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  openInline: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: ui.radius.pill,
  },
  openInlineText: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.8,
  },
  body: { fontSize: 15, fontWeight: '600', opacity: 0.85, lineHeight: 22 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  quote: { fontSize: 16, fontWeight: '700', lineHeight: 24, opacity: 0.9 },
  author: { fontSize: 13, fontWeight: '900' },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  noticeTitle: { fontSize: 16, fontWeight: '900' },
  noticeBody: { fontSize: 14, fontWeight: '600', opacity: 0.75, marginTop: 6 },
});

