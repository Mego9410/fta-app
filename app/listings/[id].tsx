import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

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
import { getListingMapUrl, getListingAreaRadius } from '@/src/ui/map/listingMap';
import { InteractiveMap } from '@/src/ui/map/InteractiveMap';

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [listing, setListing] = useState<Listing | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!id) return;
    const l = await getListingById(id);
    setListing(l);
    if (l) setSaved(await isFavorite(l.id));
  };

  useEffect(() => {
    load();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // HTML parsing disabled - using Supabase data only
  // useEffect(() => {
  //   (async () => {
  //     if (!listing || listing.detailedInformationText) return; // Skip if already have it
  //     
  //     // HTML parsing code disabled - relying on Supabase data only
  //   })();
  // }, [listing]);

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
  const areaRadius = map?.coords ? getListingAreaRadius(map.coords) : undefined;

  const heroSlides = useMemo(() => {
    const slides: Array<{ uri: string; kind: 'map' | 'photo' }> = [];
    if (map?.coords) slides.push({ uri: 'tilemap', kind: 'map' });
    return slides;
  }, [map?.coords]);
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
  // Force light mode for save/request details menu
  const saveBg = 'rgba(255, 255, 255, 0.6)';
  const saveText = '#000000';
  const enquireBg = Colors.light.tint;
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

    // In this dataset the listing title is the marketed "location" (region/city).
    push('Location', listing.title);

    // Extract structured info from tags
    const tags = listing.tags ?? [];
    const surgeriesTag = tags.find((t) => /^\d+\s+surgeries?$/i.test(t));
    const tenureTag = tags.find((t) => /^(freehold|leasehold|virtual freehold)$/i.test(t));
    const incomeTag = tags.find((t) => /^(NHS|Private|Mixed)$/i.test(t));

    if (surgeriesTag) {
      const match = surgeriesTag.match(/^(\d+)\s+surgeries?$/i);
      if (match) push('Surgeries', match[1]);
    }
    if (tenureTag) push('Tenure', tenureTag);
    if (incomeTag) push('Income type', incomeTag);

    // Financial fields (only when present; asking price always exists)
    push('Asking', formatCurrency(listing.askingPrice));
    if (listing.grossRevenue != null) push('Fee income', formatCurrency(listing.grossRevenue));
    if (listing.cashFlow != null) push('Cash flow', formatCurrency(listing.cashFlow));
    if (listing.ebitda != null) push('EBITDA', formatCurrency(listing.ebitda));

    // Show years established if available, otherwise show the year
    if (listing.yearEstablished != null) {
      const currentYear = new Date().getFullYear();
      const years = currentYear - listing.yearEstablished;
      if (years > 0) {
        push('Established', `${years} year${years !== 1 ? 's' : ''}`);
      } else {
        push('Established', String(listing.yearEstablished));
      }
    }
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

  const practiceDescription = useMemo(() => {
    // Don't show practice details if we already have detailed information
    // (to avoid duplication of parsed structured data)
    if (detailedInformation) return null;
    
    if (!listing?.summary) return null;
    // Extract the description part (after ref and meta line, before "More info:")
    const parts = listing.summary.split(/\n\n/);
    // Skip first part (Ref. and meta), get description parts
    const descParts = parts.slice(1).filter((p) => !p.includes('More info:'));
    let description = descParts.join('\n\n').trim();
    
    // Filter out structured information that gets added by sync function
    // These patterns indicate parsed/structured data that shouldn't be in practice description
    const structuredPatterns = [
      /Established\s+(?:for\s+)?(?:over\s+)?\d+\s+years?/i,
      /Including\s+Freehold\s+of[:\s]*£/i,
      /Reconstituted\s+profit\s+of/i,
      /\d+\s+UDAs?\s+(?:with|@)\s+£/i,
      /^(?:Limited\s+Company|Sole\s+Trader|Partnership)/i,
    ];
    
    // Remove lines that match structured patterns
    const filteredLines = description
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Skip empty lines
        if (!trimmed) return false;
        // Skip lines that match structured data patterns
        for (const pattern of structuredPatterns) {
          if (pattern.test(trimmed)) return false;
        }
        return true;
      });
    
    description = filteredLines.join('\n').trim();
    return description || null;
  }, [listing, detailedInformation]);

  const yearsEstablished = useMemo(() => {
    if (!listing?.yearEstablished) return null;
    const currentYear = new Date().getFullYear();
    const years = currentYear - listing.yearEstablished;
    return years > 0 ? years : null;
  }, [listing]);

  const detailedInformation = useMemo(() => {
    if (!listing) return null;
    
    // Helper function to format text as bullet points
    const formatAsBullets = (text: string): string => {
      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // If already has bullets, return as-is
      if (lines.some(line => line.startsWith('•'))) {
        return lines.join('\n');
      }
      
      // Otherwise, add bullets
      return lines.map(line => `• ${line}`).join('\n');
    };
    
    // Use the detailed information text block from Supabase database only
    // HTML parsing is disabled - relying on Supabase data only
    if (listing.detailedInformationText) {
      return formatAsBullets(listing.detailedInformationText);
    }
    
    // No HTML parsing - return null if not in database
    return null;
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
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Platform.OS === 'ios' ? Colors[theme].tint : undefined}
            colors={Platform.OS === 'android' ? [Colors[theme].tint] : undefined}
          />
        }
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.carousel}>
          {map?.coords ? (
            <View style={[styles.carouselSlide, { width: screenWidth }]}>
              <InteractiveMap
                latitude={map.coords.latitude}
                longitude={map.coords.longitude}
                width={Math.max(1, Math.round(screenWidth))}
                height={270}
                radiusMeters={areaRadius}
                initialZoom={mapZoom}
              />
              <View style={styles.carouselScrim} pointerEvents="none" />
              <View style={styles.mapBadge} pointerEvents="none">
                <Text style={styles.mapBadgeText}>
                  Location map{map.coords.source === 'exact' ? '' : ' (approx)'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.carouselSlide, { width: screenWidth }]}>
              <View style={[styles.carouselImage, styles.carouselPlaceholder]} />
            </View>
          )}
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

          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: cardBorder }]}>
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

          {(detailedInformation || moreInfoUrl) ? (
            <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: cardBorder }]}>
              <Text style={styles.cardTitle}>Detailed Information</Text>
              {detailedInformation ? (
                <Text style={styles.detailedInfoText}>{detailedInformation}</Text>
              ) : null}

              {moreInfoUrl ? (
                <Pressable
                  style={[
                    styles.moreInfoBtn,
                    {
                      borderColor: cardBorder,
                      backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      marginTop: detailedInformation ? 12 : 0,
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
          ) : null}

          {practiceDescription ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={styles.cardTitle}>Practice details</Text>
              <Text style={styles.body}>{practiceDescription}</Text>
            </View>
          ) : null}

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
              backgroundColor: 'rgba(255, 255, 255, 0.70)',
              borderColor: 'rgba(0,0,0,0.10)',
            },
          ]}>
          <Pressable
            style={[styles.ctaBtn, { borderWidth: 1, borderColor: '#CCCCCC', overflow: 'hidden' }]}
            onPress={async () => {
              const next = await toggleFavorite(listing.id);
              setSaved(next);
            }}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <FontAwesome
              name={saved ? 'heart' : 'heart-o'}
              size={18}
              color={saveText}
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
  root: { flex: 1, backgroundColor: '#f7f7f7' },
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
    color: '#000000',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.85,
    fontWeight: '600',
    color: '#000000',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
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
    opacity: 0.85,
    color: '#000000',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  body: {
    fontSize: 15,
    opacity: 1.0,
    lineHeight: 21,
    color: '#000000',
  },
  detailedInfoText: {
    fontSize: 15,
    opacity: 1.0,
    lineHeight: 22,
    fontWeight: '600',
    color: '#000000',
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

