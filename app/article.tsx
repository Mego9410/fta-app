import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchArticleDetail, type ArticleBlock, type ArticleDetail, type ArticleInline } from '@/src/data/webContent/articles';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { ui } from '@/src/ui/theme';

function splitParagraphs(input: string): string[] {
  const raw = (input ?? '').trim();
  if (!raw) return [];
  // Normalize newlines and split on blank lines.
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const hasBlankLines = /\n{2,}/.test(normalized);
  const parts = hasBlankLines ? normalized.split(/\n{2,}/g) : normalized.split(/\n+/g);
  return parts.map((p) => p.replace(/\n+/g, '\n').trim()).filter(Boolean);
}

function normalizeKeyText(text: string) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function InlineRuns({ inlines, variant }: { inlines: ArticleInline[]; variant: 'p' | 'h2' | 'h3' | 'li' }) {
  const baseStyle =
+    variant === 'h2'
      ? styles.h2
      : variant === 'h3'
        ? styles.h3
        : variant === 'li'
          ? styles.liText
          : styles.body;

  return (
    <Text style={baseStyle}>
      {inlines.map((r, idx) => {
        const key = `${idx}-${normalizeKeyText(r.text).slice(0, 24)}`;
        const runStyle = [r.bold ? styles.bold : null, r.italic ? styles.italic : null];
        return (
          <Text key={key} style={runStyle}>
            {r.text}
            {idx === inlines.length - 1 ? '' : ' '}
          </Text>
        );
      })}
    </Text>
  );
}

function BlocksView({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <View style={styles.paragraphs}>
      {blocks.map((b, idx) => {
        const key = `${idx}-${b.type}`;
        if (b.type === 'li') {
          return (
            <View key={key} style={styles.liRow}>
              <Text style={styles.liBullet}>•</Text>
              <View style={{ flex: 1 }}>
                <InlineRuns inlines={b.inlines} variant="li" />
              </View>
            </View>
          );
        }
        return (
          <InlineRuns
            key={key}
            inlines={b.inlines}
            variant={b.type === 'h2' ? 'h2' : b.type === 'h3' ? 'h3' : 'p'}
          />
        );
      })}
    </View>
  );
}

export default function ArticleScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const articleUrl = useMemo(() => (typeof url === 'string' ? url : ''), [url]);
  const theme = useColorScheme() ?? 'light';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const chipBg = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  const [data, setData] = useState<ArticleDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!articleUrl) return;
    setStatus('loading');
    try {
      const res = await fetchArticleDetail(articleUrl);
      setData(res);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [articleUrl]);

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

  const title = data?.title ?? 'Article';
  const paragraphs = useMemo(() => splitParagraphs(data?.contentText ?? ''), [data?.contentText]);
  const blocks = data?.blocks ?? null;

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
          gap: 10,
        }}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.wrap}>
          <ScreenHeader
            title={title}
            subtitle={data?.dateText ?? undefined}
            fallbackHref="/articles"
            style={{ paddingHorizontal: 0 }}
            right={
              articleUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    if (Platform.OS === 'web') {
                      window.open(articleUrl, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    await WebBrowser.openBrowserAsync(articleUrl);
                  }}
                  style={[styles.openInline, { backgroundColor: chipBg }]}>
                  <Text style={styles.openInlineText}>Open original</Text>
                </Pressable>
              ) : null
            }
          />

          {status === 'loading' ? <Text style={styles.body}>Loading…</Text> : null}
          {status === 'error' ? (
            <View style={[styles.notice, { borderColor }]}>
              <Text style={styles.noticeTitle}>Couldn’t load this article</Text>
              <Text style={styles.noticeBody}>You can try again, or open the original on the website.</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <SecondaryButton title="Try again" onPress={load} />
                {articleUrl ? (
                  <SecondaryButton
                    title="Open original"
                    onPress={async () => {
                      if (Platform.OS === 'web') {
                        window.open(articleUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      await WebBrowser.openBrowserAsync(articleUrl);
                    }}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {status !== 'loading' && status !== 'error' && paragraphs.length === 0 && data ? (
            <View style={[styles.notice, { borderColor }]}>
              <Text style={styles.noticeTitle}>No content</Text>
              <Text style={styles.noticeBody}>This article didn’t include readable content in our in-app view.</Text>
              {articleUrl ? (
                <View style={{ marginTop: 12 }}>
                  <SecondaryButton
                    title="Open original"
                    onPress={async () => {
                      if (Platform.OS === 'web') {
                        window.open(articleUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      await WebBrowser.openBrowserAsync(articleUrl);
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {blocks?.length ? (
            <BlocksView blocks={blocks} />
          ) : (
            <View style={styles.paragraphs}>
              {paragraphs.map((p, idx) => (
                <Text key={`${idx}-${p.slice(0, 24)}`} style={styles.body}>
                  {p}
                </Text>
              ))}
            </View>
          )}

          {articleUrl ? (
            <View style={{ paddingTop: 6 }}>
              <SecondaryButton
                title="Open original article"
                onPress={async () => {
                  if (typeof window !== 'undefined' && window.open) {
                    window.open(articleUrl, '_blank', 'noopener,noreferrer');
                  } else {
                    await WebBrowser.openBrowserAsync(articleUrl);
                  }
                }}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
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
    opacity: 0.9,
    color: '#000000',
  },
  paragraphs: { gap: 12, paddingTop: 12 },
  body: { fontSize: 15, fontWeight: '600', opacity: 1.0, lineHeight: 22, color: '#000000' },
  h2: { fontSize: 18, fontWeight: '900', lineHeight: 24, marginTop: 6, color: '#000000' },
  h3: { fontSize: 16, fontWeight: '900', lineHeight: 22, marginTop: 2, color: '#000000' },
  bold: { fontWeight: '900', color: '#000000' },
  italic: { fontStyle: 'italic', color: '#000000' },
  liRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  liBullet: { fontSize: 16, fontWeight: '900', opacity: 1.0, paddingTop: 2, color: '#000000' },
  liText: { fontSize: 15, fontWeight: '600', opacity: 1.0, lineHeight: 22, color: '#000000' },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
  },
  noticeTitle: { fontSize: 16, fontWeight: '900', color: '#000000' },
  noticeBody: { fontSize: 14, fontWeight: '600', opacity: 0.85, marginTop: 6, color: '#000000' },
});

