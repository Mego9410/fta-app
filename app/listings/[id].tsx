import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Listing } from '@/src/domain/types';
import { getListingById } from '@/src/data/listingsRepo';
import { isFavorite, toggleFavorite } from '@/src/data/favoritesRepo';
import { formatCurrency } from '@/src/ui/format';
import { Chip } from '@/src/ui/components/Chip';
import { LiquidGlassBackButton } from '@/src/ui/components/LiquidGlassBackButton';
import { ui } from '@/src/ui/theme';
import { getListingMapUrl } from '@/src/ui/map/listingMap';
import { StaticTileMap } from '@/src/ui/map/StaticTileMap';

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [listing, setListing] = useState<Listing | null>(null);
  const [saved, setSaved] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const l = await getListingById(id);
      setListing(l);
      if (l) setSaved(await isFavorite(l.id));
    })();
  }, [id]);

  const moreInfoUrl = useMemo(() => {
    if (listing?.moreInfoUrl) return listing.moreInfoUrl;
    const m = listing?.summary?.match(/More info:\s*(https?:\/\/\S+)/i);
    return m?.[1] ?? null;
  }, [listing]);

  const map = useMemo(() => {
    if (!listing) return null;
    return getListingMapUrl(listing, { width: 1024, height: 640, zoom: 7 });
  }, [listing]);
  const mapZoom = map?.coords.source === 'exact' ? 11 : map?.coords.source === 'lookup' ? 7 : 6;

  const heroSlides = useMemo(() => {
    const base = listing?.photos ?? [];
    const slides: Array<{ uri: string; kind: 'map' | 'photo' }> = [];
    if (map?.coords) slides.push({ uri: 'tilemap', kind: 'map' });
    for (const uri of base) {
      if (!uri) continue;
      slides.push({ uri, kind: 'photo' });
    }
    return slides;
  }, [listing, map?.coords]);
  const isUnderOffer = useMemo(() => {
    if (!listing) return false;
    return (
      (listing.tags ?? []).some((t) => t.trim().toLowerCase() === 'under offer') ||
      /Status:\s*Under Offer/i.test(listing.summary ?? '')
    );
  }, [listing]);

  const cardBg = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const cardBorder = theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const tonalText = theme === 'dark' ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.78)';
  const saveBg = theme === 'dark' ? 'rgba(255,255,255,0.10)' : '#000';
  const saveText = theme === 'dark' ? 'rgba(255,255,255,0.92)' : 'white';
  const enquireBg = Colors[theme].tint;
  const enquireText = '#0b0f1a';

  const keyDetails = useMemo(() => {
    if (!listing) return [];
    const items: Array<{ label: string; value: string }> = [];
    const push = (label: string, value: string | null | undefined) => {
      if (!value) return;
      const v = value.trim();
      if (!v) return;
      items.push({ label, value: v });
    };

    // In this dataset the listing title is the marketed “location” (region/city).
    push('Location', listing.title);

    // Financial fields (only when present; asking price always exists)
    push('Asking', formatCurrency(listing.askingPrice));
    if (listing.grossRevenue != null) push('Fee income', formatCurrency(listing.grossRevenue));
    if (listing.cashFlow != null) push('Cash flow', formatCurrency(listing.cashFlow));
    if (listing.ebitda != null) push('EBITDA', formatCurrency(listing.ebitda));

    if (listing.yearEstablished != null) push('Established', String(listing.yearEstablished));
    if (listing.employeesRange) push('Employees', listing.employeesRange);

    return items;
  }, [listing]);

  const refCode = useMemo(() => {
    if (!listing?.summary) return null;
    const m = listing.summary.match(/Ref\.\s*([A-Za-z0-9-]+)/i);
    const raw = m?.[1]?.trim() ?? null;
    if (!raw) return null;

    // Some sources append tenure immediately after the ref (e.g. `Ref. 14-96-3451Leasehold`).
    const cleaned = raw.replace(/\s*(virtual freehold|leasehold|freehold)\s*$/i, '').trim();
    return cleaned || null;
  }, [listing]);

  if (!listing) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Listing</Text>
        <Text style={styles.subtitle}>{id ? 'Loading…' : 'Missing listing id.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.carousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const w = Math.max(1, screenWidth);
              const next = Math.round(e.nativeEvent.contentOffset.x / w);
              setHeroIndex(next);
            }}>
            {heroSlides.length ? (
              heroSlides.map((s, idx) => (
                <View key={`${s.kind}-${s.uri}-${idx}`} style={[styles.carouselSlide, { width: screenWidth }]}>
                  {s.kind === 'map' && map?.coords ? (
                    <StaticTileMap
                      latitude={map.coords.latitude}
                      longitude={map.coords.longitude}
                      width={Math.max(1, Math.round(screenWidth))}
                      height={270}
                      zoom={mapZoom}
                    />
                  ) : (
                    <Image
                      source={{ uri: s.uri }}
                      style={styles.carouselImage}
                      onError={() => {
                        // If the map provider fails, try the next provider (no placeholder UI).
                        // (Map slide is tile-based now; this only applies to photos.)
                      }}
                    />
                  )}
                  <View style={styles.carouselScrim} pointerEvents="none" />
                  {s.kind === 'map' ? (
                    <View style={styles.mapBadge} pointerEvents="none">
                      <Text style={styles.mapBadgeText}>
                        Location map{map?.coords.source === 'exact' ? '' : ' (approx)'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={[styles.carouselSlide, { width: screenWidth }]}>
                <View style={[styles.carouselImage, styles.carouselPlaceholder]} />
              </View>
            )}
          </ScrollView>

          {heroSlides.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {heroSlides.slice(0, 8).map((_, i) => (
                <View key={i} style={[styles.dot, i === heroIndex ? styles.dotActive : null]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.container}>
          {isUnderOffer ? (
            <View style={[styles.statusBanner, { backgroundColor: Colors[theme].tint }]}>
              <Text style={styles.statusBannerText}>UNDER OFFER</Text>
            </View>
          ) : null}
          <Text style={styles.price}>{formatCurrency(listing.askingPrice)}</Text>
          <Text style={styles.title}>{listing.title}</Text>
          {refCode ? <Text style={styles.subtitle}>Ref. {refCode}</Text> : null}

          <View style={styles.chips}>
            {listing.featured ? <Chip label="Featured" /> : null}
            {listing.tags?.slice(0, 6).map((t) => (
              <Chip key={t} label={t} />
            ))}
            {listing.confidential ? <Chip label="Confidential" /> : null}
            {listing.financingAvailable ? <Chip label="Financing Available" /> : null}
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={styles.cardTitle}>Key details</Text>
            <View style={styles.detailGrid}>
              {keyDetails.map((d) => (
                <View key={d.label} style={styles.detailTile}>
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {d.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={styles.cardTitle}>Financial snapshot</Text>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>Asking price</Text>
              <Text style={styles.finValue}>{formatCurrency(listing.askingPrice)}</Text>
            </View>
            {listing.grossRevenue != null ? (
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Fee income</Text>
                <Text style={styles.finValue}>{formatCurrency(listing.grossRevenue)}</Text>
              </View>
            ) : null}
            {listing.cashFlow != null ? (
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Cash flow</Text>
                <Text style={styles.finValue}>{formatCurrency(listing.cashFlow)}</Text>
              </View>
            ) : null}
            {listing.ebitda != null ? (
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>EBITDA</Text>
                <Text style={styles.finValue}>{formatCurrency(listing.ebitda)}</Text>
              </View>
            ) : null}

            {moreInfoUrl ? (
              <Pressable
                style={[
                  styles.moreInfoBtn,
                  {
                    borderColor: cardBorder,
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
                onPress={async () => {
                  if (Platform.OS === 'web') {
                    window.open(moreInfoUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  await WebBrowser.openBrowserAsync(moreInfoUrl);
                }}>
                <Text style={styles.moreInfoText}>More info</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.ctaBar,
          {
            paddingBottom: 14 + insets.bottom,
          },
        ]}>
        <View
          style={[
            styles.ctaFloating,
            {
              backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.70)',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
            },
          ]}>
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: saveBg }]}
            onPress={async () => {
              const next = await toggleFavorite(listing.id);
              setSaved(next);
            }}>
            <FontAwesome
              name={saved ? 'heart' : 'heart-o'}
              size={18}
              color={saved ? '#d62828' : saveText}
            />
            <Text style={[styles.ctaText, { color: saveText }]}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>

          <Pressable
            style={[styles.ctaBtn, { backgroundColor: enquireBg }]}
            onPress={() => {
              router.push({
                pathname: '/inquire/[id]',
                params: { id: listing.id },
              });
            }}>
            <FontAwesome name="envelope" size={18} color={enquireText} />
            <Text style={[styles.ctaText, { color: enquireText }]}>Request details</Text>
          </Pressable>
        </View>
      </View>

      {/* Keep back button LAST so it overlays the hero carousel + any native surfaces reliably. */}
      <LiquidGlassBackButton fallbackHref="/(tabs)" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingBottom: 140,
  },
  carousel: {
    height: 270,
    backgroundColor: '#111',
  },
  carouselSlide: {
    height: 270,
    backgroundColor: '#111',
  },
  carouselImage: {
    width: '100%',
    height: 270,
    resizeMode: 'cover',
  },
  carouselPlaceholder: {
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ui.layout.screenPaddingX,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  carouselScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  mapBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  mapBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.95,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  container: {
    flex: 1,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.75,
    fontWeight: '600',
  },
  statusBanner: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 2,
  },
  statusBannerText: {
    color: '#0b0f1a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  card: {
    marginTop: 14,
    borderRadius: ui.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: ui.spacing.md,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailTile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    opacity: 0.9,
    lineHeight: 21,
  },
  moreInfoBtn: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  moreInfoText: {
    fontSize: 15,
    fontWeight: '800',
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  finLabel: {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '600',
  },
  finValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingTop: 10,
  },
  ctaFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 6,
    gap: 10,
    ...ui.shadow.card,
  },
  ctaBtn: {
    borderRadius: ui.radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '900',
  },
});

