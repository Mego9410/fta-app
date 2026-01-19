import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ExternalLink } from '@/components/ExternalLink';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { Listing } from '@/src/domain/types';
import { listListings } from '@/src/data/listingsRepo';
import { useColorScheme } from '@/components/useColorScheme';
import { Pill } from '@/src/ui/components/Pill';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { formatCurrency } from '@/src/ui/format';
import { ui } from '@/src/ui/theme';
import { fetchLatestArticlePreviews, type ArticlePreview } from '@/src/data/webContent/articles';
import { fetchLatestTestimonials, type TestimonialPreview } from '@/src/data/webContent/testimonials';
import { getListingMapCoords } from '@/src/ui/map/listingMap';
import { StaticTileMap } from '@/src/ui/map/StaticTileMap';

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const cardBorder = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

  const [newListings, setNewListings] = useState<Listing[]>([]);
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialPreview[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Listings: show a small "new listings" sampler. Search is the main discovery surface.
    const rows = await listListings({ status: 'active' });
    const newest = [...rows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5);
    setNewListings(newest);

    const [articleRows, testimonialRows] = await Promise.all([
      fetchLatestArticlePreviews({ limit: 3 }),
      fetchLatestTestimonials({ limit: 8 }),
    ]);
    setArticles(articleRows);
    setTestimonials(testimonialRows);
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
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{
          paddingTop: insets.top + ui.spacing.lg,
          paddingBottom: bottomPad,
          paddingHorizontal: ui.layout.screenPaddingX,
          gap: ui.spacing.lg,
        }}>
        {/* Hero */}
        <View style={[styles.hero, { borderColor: cardBorder }]}>
          <Image
            accessibilityLabel="Frank Taylor & Associates logo"
            source={require('../../assets/images/FTA.jpg')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle}>Buy or sell a dental practice with confidence.</Text>
          <Text style={styles.heroSubtitle}>
            Browse practices for sale, read the latest insights, and explore recent client stories.
          </Text>

          <View style={styles.heroButtons}>
            <PrimaryButton title="Find a practice" onPress={() => router.push('/(tabs)/search')} style={{ flex: 1 }} />
            <SecondaryButton title="Sell a practice" onPress={() => router.push('/sell' as any)} style={{ flex: 1 }} />
          </View>

          <View style={styles.quickLinks}>
            <Pill label="Browse all" onPress={() => router.push('/(tabs)/search')} />
            <Pill
              label="Latest articles"
              onPress={() => router.push('/articles')}
            />
            <Pill
              label="Testimonials"
              onPress={() => router.push({ pathname: '/testimonials' } as any)}
            />
          </View>
        </View>

        {/* New listings */}
        <SectionCard
          borderColor={cardBorder}
          title="New listings"
          subtitle="Fresh opportunities added recently."
          actionLabel="View all"
          onAction={() => router.push('/(tabs)/search')}>
          {newListings.length ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={newListings}
              keyExtractor={(l) => l.id}
              contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
              renderItem={({ item }) => (
                <ListingCarouselCard
                  listing={item}
                  borderColor={cardBorder}
                  onPress={() =>
                    router.push({
                      pathname: '/listings/[id]',
                      params: { id: item.id },
                    })
                  }
                />
              )}
            />
          ) : (
            <EmptyState title="No listings yet" body="Add listings from Admin to get started." />
          )}
        </SectionCard>

        {/* Latest articles */}
        <SectionCard
          borderColor={cardBorder}
          title="Latest articles"
          subtitle="Short reads from the FTA website."
          actionLabel="See all"
          onAction={() => router.push('/articles')}>
          {articles.length ? (
            <View style={styles.articleList}>
              {articles.slice(0, 3).map((a, idx) => (
                <View key={a.url}>
                  <ArticleRow
                    title={a.title}
                    dateText={a.dateText ?? undefined}
                    onPress={() => router.push({ pathname: '/article', params: { url: a.url } })}
                  />
                  {idx < Math.min(articles.length, 3) - 1 ? <Divider /> : null}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="Insights and updates" body="Tap “See all” to read the latest articles on the FTA website." />
          )}
        </SectionCard>

        {/* Testimonials */}
        <SectionCard
          borderColor={cardBorder}
          title="Testimonials"
          subtitle="Recent client stories and outcomes."
          actionLabel="See all"
          onAction={() => router.push({ pathname: '/testimonials' } as any)}>
          {testimonials.length ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={testimonials}
              keyExtractor={(t) => t.id}
              contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
              renderItem={({ item }) => (
                <TestimonialCarouselCard
                  borderColor={cardBorder}
                  quote={item.quote}
                  author={item.author}
                  dateText={item.dateText ?? undefined}
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
                />
              )}
            />
          ) : (
            <EmptyState
              title="Trusted by practice owners"
              body="Read what clients say about selling and buying dental practices with FTA."
            />
          )}
        </SectionCard>

        {/* Socials */}
        <SectionCard
          borderColor={cardBorder}
          title="Follow us"
          subtitle="Quick links to our socials."
        >
          <View style={styles.socialLinks}>
            <SocialLink icon="instagram" label="Instagram" href="https://www.instagram.com/franktaylorassoc" />
            <SocialLink icon="linkedin" label="LinkedIn" href="https://www.linkedin.com/company/871090/?trk=tyah" />
            <SocialLink icon="facebook" label="Facebook" href="https://www.facebook.com/FrankTaylorandAssociates" />
            <SocialLink icon="youtube-play" label="YouTube" href="https://www.youtube.com/channel/UCzfUNbfoHZdv5mfAKAckD_w" />
            <SocialLink icon="twitter" label="X" href="https://x.com/FrankTaylorAssc/" />
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  brandLogo: {
    width: 260,
    height: 78,
  },
  hero: {
    borderRadius: ui.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: ui.spacing.lg,
    gap: ui.spacing.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  heroTitle: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSubtitle: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.72,
    lineHeight: 18,
    maxWidth: 360,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionCard: {
    borderRadius: ui.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: ui.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: ui.spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.72,
    marginTop: 4,
  },
  sectionAction: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '900',
  },
  articleList: {
    borderRadius: ui.radius.md,
    overflow: 'hidden',
  },
  articleRow: {
    paddingVertical: 12,
  },
  articleTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  articleMeta: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});

function SectionCard({
  borderColor,
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: {
  borderColor: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';
  const actionBg = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const divider = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  return (
    <View style={[styles.sectionCard, { borderColor }]}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={[styles.sectionSubtitle, { color: subtle }]}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} style={[styles.sectionAction, { backgroundColor: actionBg, borderColor: divider }]}>
            <Text style={[styles.sectionActionText, { color: subtle }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ArticleRow({
  title,
  dateText,
  onPress,
}: {
  title: string;
  dateText?: string;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)';
  const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  return (
    <Pressable onPress={onPress} style={styles.articleRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.articleTitle} numberOfLines={2}>
            {title}
          </Text>
          {dateText ? (
            <Text style={[styles.articleMeta, { color: subtle }]} numberOfLines={1}>
              {dateText}
            </Text>
          ) : null}
        </View>
        <FontAwesome name="chevron-right" size={14} color={iconColor} />
      </View>
    </Pressable>
  );
}

function Divider() {
  const theme = useColorScheme() ?? 'light';
  const divider = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  return <View style={[styles.divider, { backgroundColor: divider }]} />;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  const theme = useColorScheme() ?? 'light';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  return (
    <View style={{ paddingVertical: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '900' }}>{title}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: subtle, marginTop: 6 }}>{body}</Text>
    </View>
  );
}

function SocialLink({
  icon,
  label,
  href,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  href: string;
}) {
  const theme = useColorScheme() ?? 'light';
  const bg = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const textColor = Colors[theme].text;
  return (
    <ExternalLink href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Follow us on ${label}`}
        hitSlop={8}
        style={[socialStyles.iconButton, { backgroundColor: bg, borderColor }]}>
        <FontAwesome name={icon} size={26} color={textColor} />
      </Pressable>
    </ExternalLink>
  );
}

const socialStyles = StyleSheet.create({
  iconButton: {
    flexBasis: 0,
    flexGrow: 1,
    height: 60,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function ListingPreviewCard({
  listing,
  borderColor,
  onPress,
}: {
  listing: Listing;
  borderColor: string;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const meta = `${listing.locationCity}, ${listing.locationState} • ${listing.industry}`;
  const subtitle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  const price = formatCurrency(listing.askingPrice);
  return (
    <Pressable onPress={onPress} style={[cardStyles.card, { borderColor }]}>
      <View style={cardStyles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={cardStyles.title} numberOfLines={2}>
            {listing.title}
          </Text>
          <Text style={[cardStyles.meta, { color: subtitle }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={[cardStyles.pricePill, { backgroundColor: Colors[theme].tint }]}>
          <Text style={cardStyles.priceText} numberOfLines={1}>
            {price}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function LinkCard({
  borderColor,
  title,
  subtitle,
  body,
  onPress,
}: {
  borderColor: string;
  title: string;
  subtitle?: string;
  body?: string;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  return (
    <Pressable onPress={onPress} style={[cardStyles.card, { borderColor }]}>
      {subtitle ? (
        <Text style={{ fontSize: 12, fontWeight: '800', color: subtle, marginBottom: 6 }}>{subtitle}</Text>
      ) : null}
      <Text style={cardStyles.title} numberOfLines={2}>
        {title}
      </Text>
      {body ? (
        <Text style={{ fontSize: 14, fontWeight: '600', opacity: 0.75, marginTop: 6 }} numberOfLines={3}>
          {body}
        </Text>
      ) : null}
    </Pressable>
  );
}

function TestimonialCard({
  borderColor,
  quote,
  author,
  dateText,
  onPress,
}: {
  borderColor: string;
  quote: string;
  author: string;
  dateText?: string;
  onPress?: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[cardStyles.card, { borderColor }]}>
      <Text style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={5}>
        “{quote}”
      </Text>
      <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '900' }} numberOfLines={1}>
          {author}
        </Text>
        {dateText ? (
          <Text style={{ fontSize: 12, fontWeight: '800', color: subtle }} numberOfLines={1}>
            {dateText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function TestimonialCarouselCard({
  borderColor,
  quote,
  author,
  dateText,
  onPress,
}: {
  borderColor: string;
  quote: string;
  author: string;
  dateText?: string;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)';
  return (
    <Pressable onPress={onPress} style={[testimonialCarouselStyles.card, { borderColor }]}>
      <View style={testimonialCarouselStyles.iconRow}>
        <FontAwesome name="quote-left" size={16} color={iconColor} />
        <FontAwesome name="angle-right" size={18} color={iconColor} />
      </View>
      <Text style={testimonialCarouselStyles.quote} numberOfLines={7}>
        “{quote}”
      </Text>
      <View style={testimonialCarouselStyles.footerRow}>
        <Text style={testimonialCarouselStyles.author} numberOfLines={1}>
          {author}
        </Text>
        {dateText ? (
          <Text style={[testimonialCarouselStyles.date, { color: subtle }]} numberOfLines={1}>
            {dateText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyCard({
  borderColor,
  title,
  body,
}: {
  borderColor: string;
  title: string;
  body: string;
}) {
  return (
    <View style={[cardStyles.card, { borderColor }]}>
      <Text style={{ fontSize: 16, fontWeight: '900' }}>{title}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', opacity: 0.75, marginTop: 6 }}>{body}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 16, fontWeight: '900' },
  meta: { fontSize: 13, fontWeight: '700' },
  pricePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: ui.radius.pill,
    alignSelf: 'flex-start',
  },
  priceText: {
    color: '#0b0f1a',
    fontSize: 12,
    fontWeight: '900',
  },
});

const testimonialCarouselStyles = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: ui.radius.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quote: {
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.9,
    lineHeight: 22,
  },
  footerRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  author: { fontSize: 13, fontWeight: '900' },
  date: { fontSize: 12, fontWeight: '800', opacity: 0.8 },
});

function ListingCarouselCard({
  listing,
  borderColor,
  onPress,
}: {
  listing: Listing;
  borderColor: string;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtitle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  const coords = getListingMapCoords(listing);
  const mapZoom = coords?.source === 'exact' ? 11 : coords?.source === 'lookup' ? 7 : 6;
  const photo = listing.photos?.[0] ?? null;
  const price = formatCurrency(listing.askingPrice);
  return (
    <Pressable onPress={onPress} style={[carouselStyles.card, { borderColor }]}>
      {coords ? (
        <StaticTileMap
          latitude={coords.latitude}
          longitude={coords.longitude}
          width={280}
          height={150}
          zoom={mapZoom}
        />
      ) : photo ? (
        <Image source={{ uri: photo }} style={carouselStyles.image} />
      ) : (
        <View style={[carouselStyles.image, { backgroundColor: theme === 'dark' ? '#222' : '#ddd' }]} />
      )}
      <View style={carouselStyles.body}>
        <Text style={carouselStyles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={[carouselStyles.meta, { color: subtitle }]} numberOfLines={1}>
          {listing.locationCity}, {listing.locationState}
        </Text>
        <View style={[carouselStyles.pricePill, { backgroundColor: Colors[theme].tint }]}>
          <Text style={carouselStyles.priceText} numberOfLines={1}>
            {price}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const carouselStyles = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: ui.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  image: {
    width: '100%',
    height: 150,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    fontSize: 13,
    fontWeight: '700',
  },
  pricePill: {
    alignSelf: 'flex-start',
    borderRadius: ui.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  priceText: {
    color: '#0b0f1a',
    fontSize: 12,
    fontWeight: '900',
  },
});
