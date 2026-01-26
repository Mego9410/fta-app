import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import type { Listing } from '@/src/domain/types';
import { listListings } from '@/src/data/listingsRepo';
import { listFavoriteIds, toggleFavorite } from '@/src/data/favoritesRepo';
import { createLead } from '@/src/data/leadsRepo';
import { useSession } from '@/src/auth/useSession';
import { getProfile } from '@/src/supabase/profileRepo';
import { getLocalOnboardingState } from '@/src/data/onboardingLocalRepo';
import { isSupabaseConfigured } from '@/src/supabase/client';
import { SwipeableListingCard } from '@/src/ui/components/SwipeableListingCard';
import { SwipeActionButtons } from '@/src/ui/components/SwipeActionButtons';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { LiquidGlassBackButton } from '@/src/ui/components/LiquidGlassBackButton';
import { ui } from '@/src/ui/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SwipeScreen() {
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const { user, loading: sessionLoading } = useSession();
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [triggerSwipe, setTriggerSwipe] = useState<'left' | 'right' | 'up' | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      // Load all active listings
      const allListings = await listListings({ status: 'active' });
      console.log(`[Swipe] Loaded ${allListings.length} total active listings`);
      
      // Get saved listing IDs
      const savedIds = new Set(await listFavoriteIds());
      console.log(`[Swipe] User has ${savedIds.size} saved listings`);
      
      // Filter out saved listings
      const unsavedListings = allListings.filter((listing) => !savedIds.has(listing.id));
      console.log(`[Swipe] ${unsavedListings.length} unsaved listings available for swiping`);
      
      setListings(unsavedListings);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load listings:', error);
      Alert.alert('Error', 'Failed to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const currentListing = listings[currentIndex] ?? null;
  const nextListing = listings[currentIndex + 1] ?? null;
  const hasMore = currentIndex < listings.length;
  
  // Only show cards that are current or next (don't render swiped-away cards)
  const visibleListings = listings.slice(currentIndex, currentIndex + 2);

  const getProfileData = useCallback(async () => {
    let name = '';
    let email = '';
    let phone = '';

    // Try to get from Supabase profile
    if (isSupabaseConfigured && user) {
      try {
        const profile = await getProfile(user.id);
        if (profile?.full_name) name = profile.full_name;
        if (profile?.phone) phone = profile.phone;
        if (user.email) email = user.email;
      } catch (e) {
        console.warn('Failed to load Supabase profile:', e);
      }
    }

    // Fallback to local onboarding data
    if (!name || !email || !phone) {
      try {
        const local = await getLocalOnboardingState();
        if (!name && local.profile.fullName) name = local.profile.fullName;
        if (!email && local.profile.email) email = local.profile.email;
        if (!phone && local.profile.phone) phone = local.profile.phone;
      } catch (e) {
        console.warn('Failed to load local profile:', e);
      }
    }

    return { name, email, phone };
  }, [user]);

  const handleSwipeComplete = useCallback(() => {
    setProcessing(false);
    setTriggerSwipe(null); // Reset trigger
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleSwipeRight = useCallback(async (listing: Listing) => {
    if (processing) return;
    setProcessing(true);
    try {
      await toggleFavorite(listing.id);
    } catch (error) {
      console.error('Failed to save listing:', error);
      Alert.alert('Error', 'Failed to save listing. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing]);

  const handleSwipeLeft = useCallback(() => {
    // Just skip - no action needed
  }, []);

  const handleSwipeUp = useCallback(async (listing: Listing, shouldAnimate: boolean = false) => {
    if (processing) return;
    
    // Show confirmation dialog
    Alert.alert(
      'Request Details',
      `Would you like to request details for "${listing.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // If this was from a gesture swipe, we need to reset the card
            // (the animation already happened, so we'll just mark as complete)
            if (shouldAnimate) {
              handleSwipeComplete();
            }
          },
        },
        {
          text: 'Request Details',
          onPress: async () => {
            setProcessing(true);
            try {
              // Get user profile data
              const { name, email, phone } = await getProfileData();

              if (!name || !email || !phone) {
                Alert.alert(
                  'Profile Required',
                  'Please complete your profile (name, email, phone) before requesting details. You can update it in Profile settings.',
                  [
                    {
                      text: 'OK',
                      onPress: () => router.push('/(tabs)/profile'),
                    },
                  ]
                );
                setProcessing(false);
                if (shouldAnimate) {
                  handleSwipeComplete();
                }
                return;
              }

              // Create inquiry lead
              await createLead({
                type: 'buyerInquiry',
                listingId: listing.id,
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                message: `Requested details from Match My Practice - ${listing.title}`,
              });

              // Also save to favorites (request details = like + inquiry)
              await toggleFavorite(listing.id);

              // If this was from button click, trigger animation now
              if (!shouldAnimate) {
                setTriggerSwipe('up');
              }
              
              Alert.alert('Request Sent!', `Your request for details about "${listing.title}" has been sent.`);
            } catch (error) {
              console.error('Failed to create inquiry:', error);
              Alert.alert('Error', 'Failed to send request. Please try again.');
              setProcessing(false);
              if (shouldAnimate) {
                handleSwipeComplete();
              }
            }
          },
        },
      ]
    );
  }, [processing, getProfileData, handleSwipeComplete]);

  const triggerSwipeAction = useCallback((direction: 'left' | 'right' | 'up') => {
    if (!currentListing || processing) return;
    
    // For "up" (request details), show confirmation first
    if (direction === 'up') {
      handleSwipeUp(currentListing);
      return;
    }
    
    // For left/right, proceed immediately
    setProcessing(true);
    setTriggerSwipe(direction);
  }, [currentListing, processing, handleSwipeUp]);

  // Reset trigger after swipe is initiated
  useEffect(() => {
    if (triggerSwipe) {
      // Reset after a short delay to allow the component to react
      const timer = setTimeout(() => {
        setTriggerSwipe(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [triggerSwipe]);

  const renderCustomHeader = (subtitle: string) => (
    <View style={[styles.customHeader, { paddingTop: insets.top + 4 }]}>
      <LiquidGlassBackButton
        fallbackHref="/(tabs)/profile/admin"
        forceShow={true}
        style={styles.customBackButton}
      />
      <View style={styles.centeredTitleContainer}>
        <Text style={styles.centeredTitle} numberOfLines={2}>
          Match My Practice
        </Text>
        {subtitle ? (
          <Text style={styles.centeredSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderCustomHeader('Loading listings...')}
      </View>
    );
  }

  if (!hasMore) {
    return (
      <View style={styles.container}>
        {renderCustomHeader('All done!')}
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No more listings</Text>
          <Text style={styles.emptyBody}>
            You've swiped through all available practices. Check back later for new listings!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {renderCustomHeader(`${listings.length - currentIndex} remaining`)}
      
      <View style={styles.cardStack}>
        {/* Render visible cards in reverse order so current is on top */}
        {visibleListings.map((listing, idx) => {
          const isCurrent = idx === 0;
          const isNext = idx === 1;
          
          if (isCurrent) {
            return (
              <View key={`card-${listing.id}-${currentIndex}`} style={styles.currentCardContainer}>
                <SwipeableListingCard
                  listing={listing}
                  index={0}
                  triggerSwipeDirection={triggerSwipe}
                  onSwipeLeft={() => handleSwipeLeft()}
                  onSwipeRight={() => handleSwipeRight(listing)}
                  onSwipeUp={() => handleSwipeUp(listing, true)}
                  onSwipeComplete={handleSwipeComplete}
                />
              </View>
            );
          } else if (isNext) {
            return (
              <View key={`card-${listing.id}-${currentIndex + 1}`} style={styles.nextCardContainer}>
                <SwipeableListingCard
                  listing={listing}
                  index={1}
                  onSwipeComplete={handleSwipeComplete}
                />
              </View>
            );
          }
          return null;
        })}
      </View>

      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + 20 }]}>
        <SwipeActionButtons
          onLike={() => triggerSwipeAction('right')}
          onDislike={() => triggerSwipeAction('left')}
          onSuperlike={() => triggerSwipeAction('up')}
          disabled={processing || !currentListing}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardStack: {
    flex: 1,
    position: 'relative',
    paddingBottom: 100,
  },
  currentCardContainer: {
    position: 'absolute',
    width: '100%',
    top: 0,
    bottom: 100,
    zIndex: 2,
  },
  nextCardContainer: {
    position: 'absolute',
    width: '100%',
    top: 0,
    bottom: 100,
    zIndex: 1,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ui.layout.screenPaddingX,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 24,
  },
  customHeader: {
    paddingHorizontal: 0,
    paddingBottom: 1,
    position: 'relative',
  },
  customBackButton: {
    position: 'absolute',
    left: 24, // More padding from left wall
    zIndex: 10,
  },
  centeredTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 60, // Padding to account for back button on left
    minHeight: 32,
    paddingVertical: 2,
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  centeredSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 2,
  },
});
