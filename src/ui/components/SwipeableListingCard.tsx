import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import type { Listing } from '@/src/domain/types';
import { formatCurrency } from '@/src/ui/format';
import { Chip } from '@/src/ui/components/Chip';
import { ui } from '@/src/ui/theme';
import { getListingMapCoords } from '@/src/ui/map/listingMap';
import { StaticTileMap } from '@/src/ui/map/StaticTileMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const ROTATION_MULTIPLIER = 0.1;

function extractRefCode(listing: Listing): string | null {
  if (listing.summary) {
    const m = listing.summary.match(/Ref\.\s*([A-Za-z0-9-]+)/i);
    const raw = m?.[1]?.trim() ?? null;
    if (!raw) return null;
    const cleaned = raw.replace(/\s*(virtual freehold|leasehold|freehold)\s*$/i, '').trim();
    return cleaned || null;
  }
  if (listing.id.startsWith('ftaweb-')) {
    return listing.id.replace('ftaweb-', '');
  }
  return null;
}

export function SwipeableListingCard({
  listing,
  index,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeComplete,
  triggerSwipeDirection,
}: {
  listing: Listing;
  index: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeComplete?: () => void;
  triggerSwipeDirection?: 'left' | 'right' | 'up' | null;
}) {
  const theme = useColorScheme() ?? 'light';
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [mapWidth, setMapWidth] = useState(0);
  
  const coords = useMemo(() => getListingMapCoords(listing), [listing]);
  const mapZoom = coords?.source === 'exact' ? 11 : coords?.source === 'lookup' ? 7 : 6;
  const photo = listing.photos?.[0] ?? null;
  const showingMap = !!coords && mapWidth > 0;
  const cardBorder = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const refCode = useMemo(() => extractRefCode(listing), [listing]);
  
  const location = listing.locationState?.toUpperCase() === 'UK' 
    ? listing.locationCity 
    : `${listing.locationCity}, ${listing.locationState}`;

  // Extract key details
  const keyDetails = useMemo(() => {
    const details: Array<{ label: string; value: string }> = [];
    const tags = listing.tags ?? [];
    
    // Surgeries
    const surgeriesTag = tags.find((t) => /^\d+\s+surgeries?$/i.test(t));
    if (surgeriesTag) {
      const match = surgeriesTag.match(/^(\d+)\s+surgeries?$/i);
      if (match) details.push({ label: 'Surgeries', value: match[1] });
    }
    
    // Tenure
    const tenureTag = tags.find((t) => /^(freehold|leasehold|virtual freehold)$/i.test(t));
    if (tenureTag) details.push({ label: 'Tenure', value: tenureTag });
    
    // Income type
    const incomeTag = tags.find((t) => /^(NHS|Private|Mixed)$/i.test(t));
    if (incomeTag) details.push({ label: 'Income', value: incomeTag });
    
    // Status
    const isUnderOffer = tags.some((t) => t.trim().toLowerCase() === 'under offer') ||
      /Status:\s*Under Offer/i.test(listing.summary ?? '');
    details.push({ label: 'Status', value: isUnderOffer ? 'Under Offer' : 'Available' });
    
    // Financial details
    if (listing.grossRevenue != null) {
      details.push({ label: 'Fee income', value: formatCurrency(listing.grossRevenue) });
    }
    if (listing.cashFlow != null) {
      details.push({ label: 'Cash flow', value: formatCurrency(listing.cashFlow) });
    }
    if (listing.ebitda != null) {
      details.push({ label: 'EBITDA', value: formatCurrency(listing.ebitda) });
    }
    
    // Year established
    if (listing.yearEstablished != null) {
      const currentYear = new Date().getFullYear();
      const years = currentYear - listing.yearEstablished;
      if (years > 0) {
        details.push({ label: 'Established', value: `${years} year${years !== 1 ? 's' : ''}` });
      } else {
        details.push({ label: 'Established', value: String(listing.yearEstablished) });
      }
    }
    
    return details;
  }, [listing]);

  const handleSwipeComplete = useCallback(() => {
    if (onSwipeComplete) {
      onSwipeComplete();
    }
  }, [onSwipeComplete]);

  const performSwipe = useCallback((direction: 'left' | 'right' | 'up') => {
    if (direction === 'right') {
      translateX.value = withSpring(SCREEN_WIDTH * 1.5, {}, () => {
        runOnJS(handleSwipeComplete)();
        if (onSwipeRight) {
          runOnJS(onSwipeRight)();
        }
      });
      translateY.value = withSpring(0);
    } else if (direction === 'left') {
      translateX.value = withSpring(-SCREEN_WIDTH * 1.5, {}, () => {
        runOnJS(handleSwipeComplete)();
        if (onSwipeLeft) {
          runOnJS(onSwipeLeft)();
        }
      });
      translateY.value = withSpring(0);
    } else if (direction === 'up') {
      translateY.value = withSpring(-SCREEN_WIDTH * 1.5, {}, () => {
        runOnJS(handleSwipeComplete)();
        if (onSwipeUp) {
          runOnJS(onSwipeUp)();
        }
      });
      translateX.value = withSpring(0);
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, handleSwipeComplete]);

  // Reset translate values when card becomes the top card
  useEffect(() => {
    if (index === 0) {
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [index, translateX, translateY]);

  // Handle programmatic swipe triggers
  useEffect(() => {
    if (triggerSwipeDirection && index === 0) {
      performSwipe(triggerSwipeDirection);
    }
  }, [triggerSwipeDirection, index, performSwipe]);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      const absX = Math.abs(translateX.value);
      const absY = Math.abs(translateY.value);
      
      // Check for up swipe (request details) - negative Y means up
      if (translateY.value < -SWIPE_THRESHOLD && absY > absX) {
        runOnJS(performSwipe)('up');
        return;
      }
      
      // Check for right swipe (like)
      if (translateX.value > SWIPE_THRESHOLD) {
        runOnJS(performSwipe)('right');
        return;
      }
      
      // Check for left swipe (dislike)
      if (translateX.value < -SWIPE_THRESHOLD) {
        runOnJS(performSwipe)('left');
        return;
      }
      
      // Snap back to center
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15]);
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp');
    return { opacity };
  });

  const nopeOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp');
    return { opacity };
  });

  const superlikeOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp');
    return { opacity };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value) + Math.abs(translateY.value),
      [0, SCREEN_WIDTH],
      [0.95, 1],
      'clamp'
    );
    return {
      transform: [{ scale }],
    };
  });

  const isTopCard = index === 0;

  const cardContent = (
    <>
      {/* Image/Map Section */}
      <View
        style={styles.imageWrap}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== mapWidth) setMapWidth(w);
        }}>
        {showingMap ? (
          <StaticTileMap
            latitude={coords.latitude}
            longitude={coords.longitude}
            width={mapWidth}
            height={500}
            zoom={mapZoom}
          />
        ) : photo ? (
          <Image source={{ uri: photo }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <View
          style={[styles.imageScrim, { backgroundColor: showingMap ? 'rgba(0,0,0,0.50)' : 'rgba(0,0,0,0.40)' }]}
          pointerEvents="none"
        />
        
        {/* Overlay Indicators */}
        {isTopCard && (
          <>
            <Animated.View style={[styles.overlay, styles.likeOverlay, likeOpacity]} pointerEvents="none">
              <Text style={styles.overlayText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeOpacity]} pointerEvents="none">
              <Text style={styles.overlayText}>NOPE</Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, styles.superlikeOverlay, superlikeOpacity]} pointerEvents="none">
              <Text style={styles.overlayText}>REQUEST DETAILS</Text>
            </Animated.View>
          </>
        )}

        {/* Top Badges */}
        <View style={styles.topBadges}>
          {refCode ? (
            <View style={styles.refCodeBadge}>
              <Text style={styles.refCodeText}>Ref. {refCode}</Text>
            </View>
          ) : null}
        </View>

        {/* Main Info Overlay on Map */}
        <View style={styles.imageBottom}>
          <View style={styles.imageBottomLeft}>
            <Text style={styles.imageTitle} numberOfLines={2}>
              {listing.title}
            </Text>
            <View style={styles.pricePill}>
              <Text style={styles.pricePillText}>{formatCurrency(listing.askingPrice)}</Text>
            </View>
            
            {/* Key Details on Map - Prominent Display */}
            {keyDetails.length > 0 && (
              <View style={styles.keyDetailsPanel}>
                {keyDetails.slice(0, 4).map((detail, idx) => (
                  <View key={idx} style={styles.keyDetailItem}>
                    <Text style={styles.keyDetailLabel}>{detail.label}</Text>
                    <Text style={styles.keyDetailValue}>{detail.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Body Section - Additional Key Details (Solid Black Background) */}
      {keyDetails.length > 4 ? (
        <View style={styles.body}>
          <View style={styles.keyDetailsGrid}>
            {keyDetails.slice(4).map((detail, idx) => (
              <View key={idx} style={styles.keyDetailTile}>
                <Text style={styles.bodyDetailLabel}>{detail.label}</Text>
                <Text style={styles.bodyDetailValue}>{detail.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.cardContainer, !isTopCard && styles.nextCard]} pointerEvents={isTopCard ? 'auto' : 'box-none'}>
      <Animated.View style={[!isTopCard && nextCardStyle]}>
        {isTopCard ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.card, { borderColor: cardBorder }, cardStyle]} pointerEvents="auto">
              {cardContent}
            </Animated.View>
          </GestureDetector>
        ) : (
          <Animated.View style={[styles.card, { borderColor: cardBorder }]} pointerEvents="none">
            {cardContent}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  nextCard: {
    zIndex: -1,
  },
  card: {
    borderRadius: ui.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.01)',
    ...ui.shadow.card,
  },
  imageWrap: {
    height: 500,
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
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  likeOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderColor: '#22c55e',
  },
  nopeOverlay: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderColor: '#ef4444',
  },
  superlikeOverlay: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    borderColor: '#3b82f6',
  },
  overlayText: {
    fontSize: 32,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 2,
  },
  topBadges: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  refCodeBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  refCodeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.95,
  },
  imageBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    zIndex: 10,
  },
  imageBottomLeft: {
    gap: 10,
  },
  imageTitle: {
    color: 'white',
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    lineHeight: 38,
  },
  imageLocation: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    opacity: 0.98,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  keyDetailsPanel: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...ui.shadow.card,
  },
  keyDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyDetailLabel: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
    opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
  },
  keyDetailValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    flex: 1,
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: ui.radius.pill,
  },
  pricePillText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0b0f1a',
  },
  body: {
    padding: 16,
    gap: 12,
    paddingBottom: 20,
    backgroundColor: '#000000',
    width: '100%',
  },
  keyDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  keyDetailTile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
  },
  bodyDetailLabel: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.7,
    color: 'white',
  },
  bodyDetailValue: {
    fontSize: 14,
    fontWeight: '900',
    color: 'white',
  },
});
