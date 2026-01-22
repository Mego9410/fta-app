import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import type { Listing } from '@/src/domain/types';
import { formatCurrency } from '@/src/ui/format';
import { Chip } from '@/src/ui/components/Chip';
import { ui } from '@/src/ui/theme';
import { getListingMapCoords } from '@/src/ui/map/listingMap';
import { StaticTileMap } from '@/src/ui/map/StaticTileMap';

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

export function ListingCard({
  listing,
  isSaved,
  onPress,
  onToggleSaved,
}: {
  listing: Listing;
  isSaved: boolean;
  onPress: () => void;
  onToggleSaved: () => void;
}) {
  const coords = useMemo(() => getListingMapCoords(listing), [listing]);
  const mapZoom = coords?.source === 'exact' ? 11 : coords?.source === 'lookup' ? 7 : 6;
  const photo = listing.photos[0] ?? null;
  const [mapWidth, setMapWidth] = useState(0);
  const showingMap = !!coords && mapWidth > 0;
  const theme = useColorScheme() ?? 'light';
  const cardBorder = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const isUnderOffer =
    (listing.tags ?? []).some((t) => t.trim().toLowerCase() === 'under offer') ||
    /Status:\s*Under Offer/i.test(listing.summary ?? '');
  const accent = Colors[theme].tint;
  const refCode = useMemo(() => extractRefCode(listing), [listing]);
  return (
    <Pressable style={[styles.card, { borderColor: cardBorder }]} onPress={onPress}>
      <View
        style={styles.imageWrap}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== mapWidth) setMapWidth(w);
        }}>
        {showingMap ? (
          <StaticTileMap latitude={coords.latitude} longitude={coords.longitude} width={mapWidth} height={210} zoom={mapZoom} />
        ) : photo ? (
          <Image source={{ uri: photo }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <View
          style={[styles.imageScrim, { backgroundColor: showingMap ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.15)' }]}
          pointerEvents="none"
        />
        <View style={styles.topLeftBadges}>
          {coords ? (
            <View style={styles.mapBadgeTopLeft} pointerEvents="none">
              <Text style={styles.mapBadgeText}>Map{coords.source === 'exact' ? '' : ' (approx)'}</Text>
            </View>
          ) : null}
          {isUnderOffer ? (
            <View style={[styles.statusBanner, { backgroundColor: accent }]}>
              <Text style={styles.statusBannerText}>UNDER OFFER</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.imageTopRow}>
          <View style={styles.badgesLeft}>
            {listing.featured ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Featured</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel={isSaved ? 'Unsave listing' : 'Save listing'}
            onPress={(e) => {
              e.stopPropagation();
              onToggleSaved();
            }}
            style={styles.heartBtn}>
            <FontAwesome
              name={isSaved ? 'heart' : 'heart-o'}
              size={20}
              color={isSaved ? '#d62828' : 'rgba(255,255,255,0.95)'}
            />
          </Pressable>
        </View>

        <View style={styles.imageBottom}>
          <View style={styles.imageBottomLeft}>
            <Text style={styles.imageTitle} numberOfLines={2}>
              {listing.title}
            </Text>
            <View style={styles.pricePill}>
              <Text style={styles.pricePillText}>{formatCurrency(listing.askingPrice)}</Text>
            </View>
          </View>
          {refCode ? (
            <View style={styles.refCodeBadgeBottom}>
              <Text style={styles.refCodeBottom} numberOfLines={1}>
                Ref. {refCode}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.chips}>
          {listing.tags?.slice(0, 4).map((t) => (
            <Chip key={t} label={t} />
          ))}
          {listing.confidential ? <Chip label="Confidential" /> : null}
          {listing.financingAvailable ? <Chip label="Financing" /> : null}
          {listing.cashFlow != null ? <Chip label={`Cash Flow ${formatCurrency(listing.cashFlow)}`} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ui.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.01)',
    marginBottom: 14,
    marginHorizontal: 4,
    ...ui.shadow.card,
  },
  imageWrap: {
    height: 210,
    backgroundColor: '#111',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: '#222',
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  topLeftBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
    zIndex: 10,
  },
  mapBadgeTopLeft: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  mapBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.95,
  },
  imageTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgesLeft: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  statusBanner: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: ui.radius.pill,
  },
  statusBannerText: {
    color: '#0b0f1a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  imageBottom: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  imageBottomLeft: {
    flex: 1,
    gap: 6,
  },
  refCodeBadgeBottom: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'flex-end',
  },
  refCodeBottom: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.95,
  },
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
  },
  pricePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b0f1a',
  },
  imageTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  body: {
    padding: 14,
    gap: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
});

