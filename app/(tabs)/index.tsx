import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ExternalLink } from '@/components/ExternalLink';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { Listing } from '@/src/domain/types';
import { listListings } from '@/src/data/listingsRepo';
import { getListingsSyncMeta, maybeSyncListingsFromWebsite } from '@/src/data/listingsSync';
import { useColorScheme } from '@/components/useColorScheme';
import { PrimaryButton } from '@/src/ui/components/PrimaryButton';
import { SecondaryButton } from '@/src/ui/components/SecondaryButton';
import { formatCurrency } from '@/src/ui/format';
import { ui } from '@/src/ui/theme';
import { fetchLatestArticlePreviews, type ArticlePreview } from '@/src/data/webContent/articles';
import { fetchLatestTestimonials, type TestimonialPreview } from '@/src/data/webContent/testimonials';
import { getListingMapCoords } from '@/src/ui/map/listingMap';
import { StaticTileMap } from '@/src/ui/map/StaticTileMap';
import { getSurgeriesCountFromTags } from '@/src/ui/searchFilters';
import { LoadingScreen } from '@/src/ui/components/LoadingScreen';

function extractRefCode(listing: Listing): string | null {
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
}

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
  const [syncLine, setSyncLine] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [fadeOutLoading, setFadeOutLoading] = useState(false);

  const load = useCallback(async () => {
    const loadStartTime = Date.now();
    const minLoadingDuration = 2500; // Minimum 2.5 seconds to show full animation
    
    await maybeSyncListingsFromWebsite();

    // Listings: show a small "new listings" sampler. Search is the main discovery surface.
    const rows = await listListings({ status: 'active' });
    
    // Sort: under offer at bottom, then by last 4 digits of reference number
    const sorted = [...rows].sort((a, b) => {
      // Check if listings are under offer
      const aUnderOffer =
        (a.tags ?? []).some((t) => t.trim().toLowerCase() === 'under offer') ||
        /Status:\s*Under Offer/i.test(a.summary ?? '');
      const bUnderOffer =
        (b.tags ?? []).some((t) => t.trim().toLowerCase() === 'under offer') ||
        /Status:\s*Under Offer/i.test(b.summary ?? '');

      // Sort: non-under-offer first (0), then under-offer (1)
      if (aUnderOffer !== bUnderOffer) {
        return aUnderOffer ? 1 : -1;
      }

      // Within each group, sort by last 4 digits of reference number
      const getLast4Digits = (refCode: string | null): number => {
        if (!refCode) return 9999; // Put listings without ref codes at the end
        // Extract all digits from the ref code
        const digits = refCode.replace(/\D/g, '');
        if (digits.length === 0) return 9999;
        // Get last 4 digits, pad with zeros if needed
        const last4 = digits.slice(-4).padStart(4, '0');
        return parseInt(last4, 10);
      };

      const aRefCode = extractRefCode(a);
      const bRefCode = extractRefCode(b);
      const aLast4 = getLast4Digits(aRefCode);
      const bLast4 = getLast4Digits(bRefCode);

      return bLast4 - aLast4;
    });
    
    const newest = sorted.slice(0, 5);
    setNewListings(newest);

    const meta = await getListingsSyncMeta();
    if (meta.lastAt) {
      const d = new Date(meta.lastAt);
      const dateText = Number.isNaN(d.getTime()) ? meta.lastAt : d.toLocaleString();
      setSyncLine(`Listings updated: ${dateText}`);
    } else {
      setSyncLine('');
    }

    const [articleRows, testimonialRows] = await Promise.all([
      fetchLatestArticlePreviews({ limit: 3 }),
      fetchLatestTestimonials({ limit: 8 }),
    ]);
    setArticles(articleRows);
    setTestimonials(testimonialRows);
    setInitialLoading(false);
    
    // Ensure loading screen shows for minimum duration, then fade out
    const elapsedTime = Date.now() - loadStartTime;
    const remainingTime = Math.max(0, minLoadingDuration - elapsedTime);
    setTimeout(() => {
      // Start fade-out animation
      setFadeOutLoading(true);
      // Hide the component after fade-out completes (600ms)
      setTimeout(() => {
        setShowLoadingScreen(false);
      }, 600);
    }, remainingTime);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await maybeSyncListingsFromWebsite({ force: true });
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <View style={styles.container}>
      {showLoadingScreen && (
        <View 
          style={[
            StyleSheet.absoluteFill, 
            { 
              zIndex: 9999, 
              elevation: 9999,
              backgroundColor: '#ffffff',
            }
          ]} 
          pointerEvents={fadeOutLoading ? 'none' : 'auto'}>
          <LoadingScreen fadeOut={fadeOutLoading} />
        </View>
      )}
      {refreshing && (
        <View style={[styles.refreshIndicator, { top: insets.top + 10 }]}>
          <ActivityIndicator size="small" color={Colors[theme].tint} />
        </View>
      )}
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
          paddingTop: insets.top + ui.spacing.lg,
          paddingBottom: bottomPad,
          paddingHorizontal: ui.layout.screenPaddingX,
          gap: ui.spacing.lg,
        }}>
        {/* Hero */}
        <View style={[styles.hero, { borderColor: cardBorder }]}>
          <View style={styles.brandLogoCard}>
            <Image
              accessibilityLabel="Frank Taylor & Associates logo"
              source={require('../../assets/images/FTA.jpg')}
              style={styles.brandLogoBackground}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroTitle}>Buy or sell a dental practice with confidence.</Text>

          <View style={styles.heroButtons}>
            <PrimaryButton title="Find a practice" onPress={() => router.push('/(tabs)/search')} style={{ flex: 1, backgroundColor: '#e4ad25' }} />
            <SecondaryButton title="Sell a practice" onPress={() => router.push('/sell' as any)} style={{ flex: 1 }} />
          </View>
        </View>

        {/* New listings */}
        <SectionCard
          borderColor={cardBorder}
          title="New listings"
          subtitle={syncLine || 'Fresh opportunities added recently.'}
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
            <LoadingScreen compact />
          )}
        </SectionCard>

        {/* Quick access buttons */}
        <View style={styles.quickAccessButtons}>
          <Pressable
            onPress={() => router.push('/articles')}
            style={styles.quickAccessButtonSecondary}>
            <FontAwesome name="newspaper-o" size={28} color="#F8C859" />
            <Text style={styles.quickAccessButtonTextSecondary}>Latest Articles</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/testimonials' } as any)}
            style={styles.quickAccessButtonPrimary}>
            <FontAwesome name="quote-left" size={28} color="#0b0f1a" />
            <Text style={styles.quickAccessButtonTextPrimary}>Testimonials</Text>
          </Pressable>
        </View>

        {/* Socials */}
        <SectionCard
          borderColor={cardBorder}
          title="Follow us"
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
    backgroundColor: '#f7f7f7',
  },
  refreshIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    paddingVertical: 8,
  },
  brandLogoCard: {
    width: 260,
    height: 78,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  brandLogoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 260,
    height: 78,
  },
  hero: {
    borderRadius: ui.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: ui.spacing.lg,
    gap: ui.spacing.md,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
  },
  heroTitle: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  quickAccessButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  quickAccessButtonSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F8C859',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  quickAccessButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8C859',
  },
  quickAccessButtonPrimary: {
    flex: 1,
    backgroundColor: '#e4ad25',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  quickAccessButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0b0f1a',
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
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.85,
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
    color: '#000000',
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
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)';
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
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)';
  const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.60)';
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
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)';
  return (
    <View style={{ paddingVertical: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '900', color: '#000000' }}>{title}</Text>
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
  return (
    <ExternalLink href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Follow us on ${label}`}
        hitSlop={8}
        style={[socialStyles.iconButton, { backgroundColor: bg, borderColor }]}>
        <FontAwesome name={icon} size={26} color="#000000" />
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
  const subtitle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  const price = formatCurrency(listing.askingPrice);
  const refCode = extractRefCode(listing);
  return (
    <Pressable onPress={onPress} style={[cardStyles.card, { borderColor }]}>
      <View style={cardStyles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={cardStyles.title} numberOfLines={2}>
            {listing.title}
          </Text>
          {refCode ? (
            <Text style={[cardStyles.refCode, { color: subtitle }]} numberOfLines={1}>
              Ref. {refCode}
            </Text>
          ) : null}
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
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)';
  return (
    <Pressable onPress={onPress} style={[cardStyles.card, { borderColor }]}>
      {subtitle ? (
        <Text style={{ fontSize: 12, fontWeight: '800', color: subtle, marginBottom: 6 }}>{subtitle}</Text>
      ) : null}
      <Text style={cardStyles.title} numberOfLines={2}>
        {title}
      </Text>
      {body ? (
        <Text style={{ fontSize: 14, fontWeight: '600', opacity: 0.85, marginTop: 6, color: '#000000' }} numberOfLines={3}>
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
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)';
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[cardStyles.card, { borderColor }]}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#000000' }} numberOfLines={5}>
        “{quote}”
      </Text>
      <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: '#000000' }} numberOfLines={1}>
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
  const subtle = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)';
  const iconColor = theme === 'dark' ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.45)';
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
      <Text style={{ fontSize: 16, fontWeight: '900', color: '#000000' }}>{title}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', opacity: 0.85, marginTop: 6, color: '#000000' }}>{body}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    ...ui.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#000000' },
  meta: { fontSize: 13, fontWeight: '700', color: '#000000' },
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
    backgroundColor: '#FFFFFF',
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
    opacity: 1.0,
    lineHeight: 22,
    color: '#000000',
  },
  footerRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  author: { fontSize: 13, fontWeight: '900', color: '#000000' },
  date: { fontSize: 12, fontWeight: '800', opacity: 0.9 },
});

function ListingCarouselCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? 'light';
  const subtitle = theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';
  const coords = getListingMapCoords(listing);
  const mapZoom = coords?.source === 'exact' ? 11 : coords?.source === 'lookup' ? 7 : 6;
  const photo = listing.photos?.[0] ?? null;
  const price = formatCurrency(listing.askingPrice);
  
  // Extract location, tenure, and surgeries from listing
  const location = listing.locationState?.toUpperCase() === 'UK' 
    ? listing.locationCity 
    : `${listing.locationCity}, ${listing.locationState}`;
  const surgeriesCount = getSurgeriesCountFromTags(listing.tags);
  const tenure = (() => {
    const tags = listing.tags ?? [];
    if (tags.includes('Virtual Freehold')) return 'Virtual Freehold';
    if (tags.includes('Freehold')) return 'Freehold';
    if (tags.includes('Leasehold')) return 'Leasehold';
    const any = tags.find((t) => /freehold|leasehold/i.test(t));
    return any ?? null;
  })();
  
  const refCode = extractRefCode(listing);
  
  return (
    <Pressable onPress={onPress} style={carouselStyles.cardWrapper}>
      <View style={carouselStyles.card}>
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
          <View style={carouselStyles.bodyRow}>
            <View style={carouselStyles.bodyLeft}>
              <Text style={carouselStyles.title} numberOfLines={2}>
                {location}
              </Text>
              <View style={carouselStyles.bodyMeta}>
                <View style={[carouselStyles.pricePill, { backgroundColor: '#E4AD25' }]}>
                  <Text style={carouselStyles.priceText} numberOfLines={1}>
                    {price}
                  </Text>
                </View>
              </View>
            </View>
            {refCode ? (
              <View style={[carouselStyles.refCodeBadge, { borderColor: subtitle }]}>
                <Text style={[carouselStyles.refCode, { color: '#666666' }]} numberOfLines={1}>
                  Ref. {refCode}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const carouselStyles = StyleSheet.create({
  cardWrapper: {
    width: 280,
  },
  card: {
    width: 280,
    borderRadius: ui.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: ui.radius.lg,
    borderTopRightRadius: ui.radius.lg,
  },
  body: {
    padding: 14,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  bodyLeft: {
    flex: 1,
    gap: 6,
  },
  bodyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  meta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  refCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  refCode: {
    fontSize: 11,
    fontWeight: '800',
  },
  pricePill: {
    borderRadius: ui.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceText: {
    color: '#0b0f1a',
    fontSize: 12,
    fontWeight: '900',
  },
});
