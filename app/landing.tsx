import { useEffect, useState } from 'react';
import { Dimensions, Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Extrapolate,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LINKS } from '@/constants/Links';
import { ui } from '@/src/ui/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Animated Phone Component
function AnimatedPhone({ scrollY, scrollProgress }: { scrollY: Animated.SharedValue<number>; scrollProgress: Animated.SharedValue<number> }) {
  const phoneWidth = isWeb ? 300 : Math.min(SCREEN_WIDTH * 0.7, 300);
  const phoneHeight = phoneWidth * 1.9;

  const phoneStyle = useAnimatedStyle(() => {
    // Rotate phone based on scroll progress (0 to 1)
    // More pronounced rotation for better visual effect
    const rotateY = interpolate(scrollProgress.value, [0, 0.5, 1], [-20, 0, 20], Extrapolate.CLAMP);
    const rotateX = interpolate(scrollProgress.value, [0, 0.5, 1], [8, 0, -8], Extrapolate.CLAMP);
    const translateY = interpolate(scrollProgress.value, [0, 0.5, 1], [-30, 0, 30], Extrapolate.CLAMP);
    const scale = interpolate(scrollProgress.value, [0, 0.5, 1], [0.95, 1, 0.95], Extrapolate.CLAMP);

    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
        { rotateX: `${rotateX}deg` },
        { translateY },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.phoneContainer, phoneStyle]}>
      <View style={[styles.phoneFrame, { width: phoneWidth, height: phoneHeight }]}>
        {/* Phone notch */}
        <View style={styles.phoneNotch} />
        {/* Phone screen */}
        <View style={styles.phoneScreen}>
          {/* Placeholder for app screenshot - user can replace this */}
          <View style={styles.phoneScreenContent}>
            <Image
              source={require('../assets/images/FTA.jpg')}
              style={styles.phoneScreenImage}
              resizeMode="contain"
            />
            <Text style={styles.phoneScreenText}>FTA App</Text>
          </View>
        </View>
        {/* Phone home indicator */}
        <View style={styles.phoneHomeIndicator} />
      </View>
    </Animated.View>
  );
}

// Floating Background Shapes Component
function FloatingShapes() {
  const shape1Y = useSharedValue(0);
  const shape2Y = useSharedValue(0);
  const shape3Y = useSharedValue(0);
  const shape1X = useSharedValue(0);
  const shape2X = useSharedValue(0);
  const shape3X = useSharedValue(0);

  useEffect(() => {
    // Continuous floating animations
    shape1Y.value = withRepeat(withTiming(30, { duration: 3000 }), -1, true);
    shape1X.value = withRepeat(withTiming(20, { duration: 4000 }), -1, true);
    shape2Y.value = withRepeat(withTiming(-25, { duration: 3500 }), -1, true);
    shape2X.value = withRepeat(withTiming(-15, { duration: 4500 }), -1, true);
    shape3Y.value = withRepeat(withTiming(20, { duration: 2800 }), -1, true);
    shape3X.value = withRepeat(withTiming(25, { duration: 3800 }), -1, true);
  }, []);

  const shape1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: shape1Y.value }, { translateX: shape1X.value }],
  }));

  const shape2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: shape2Y.value }, { translateX: shape2X.value }],
  }));

  const shape3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: shape3Y.value }, { translateX: shape3X.value }],
  }));

  return (
    <>
      <Animated.View style={[styles.floatingShape, styles.shape1, shape1Style]} />
      <Animated.View style={[styles.floatingShape, styles.shape2, shape2Style]} />
      <Animated.View style={[styles.floatingShape, styles.shape3, shape3Style]} />
    </>
  );
}

// Animated Section Component
function AnimatedSection({
  children,
  scrollY,
  startOffset,
  endOffset,
}: {
  children: React.ReactNode;
  scrollY: Animated.SharedValue<number>;
  startOffset: number;
  endOffset: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [startOffset - 200, startOffset], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(scrollY.value, [startOffset - 200, startOffset], [30, 0], Extrapolate.CLAMP);

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function LandingPage() {
  const scrollY = useSharedValue(0);
  const scrollProgress = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(SCREEN_HEIGHT * 4);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      // Calculate scroll progress (0 to 1) based on scroll position
      // Normalize to first 80% of scroll for phone animation
      const animationRange = SCREEN_HEIGHT * 2.5; // Phone animates in first 2.5 screen heights
      scrollProgress.value = Math.min(1, Math.max(0, event.contentOffset.y / animationRange));
    },
  });

  const backgroundStyle = useAnimatedStyle(() => {
    // Subtle background color shift based on scroll
    const colorShift = interpolate(scrollProgress.value, [0, 0.5, 1], [0, 5, 0], Extrapolate.CLAMP);
    return {
      backgroundColor: `rgba(${247 - colorShift}, ${247 - colorShift}, ${247 - colorShift}, 1)`,
    };
  });

  const handleAppStorePress = () => {
    // Placeholder - replace with actual App Store URL
    Linking.openURL('https://apps.apple.com/app/placeholder').catch(() => {});
  };

  const handleGooglePlayPress = () => {
    // Placeholder - replace with actual Google Play URL
    Linking.openURL('https://play.google.com/store/apps/details?id=placeholder').catch(() => {});
  };

  const handleLinkPress = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <Animated.View style={[styles.background, backgroundStyle]} />
      <FloatingShapes />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onContentSizeChange={(width, height) => setContentHeight(height)}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        {/* 1. Hook Section (Hero) */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <AnimatedSection scrollY={scrollY} startOffset={0} endOffset={200}>
              <Image
                source={require('../assets/images/FTA.jpg')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Frank Taylor & Associates logo"
              />
              <Text style={styles.heroTitle}>Find the right dental practice—faster.</Text>
            </AnimatedSection>
            <AnimatedPhone scrollY={scrollY} scrollProgress={scrollProgress} />
          </View>
        </View>

        {/* 2. Promise of Value Section */}
        <AnimatedSection scrollY={scrollY} startOffset={600} endOffset={800}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connect with Opportunities</Text>
            <Text style={styles.sectionDescription}>
              We connect buyers and sellers of dental practices and help you find opportunities that match your criteria.
            </Text>
            <Text style={styles.sectionSubtext}>
              Experience smarter, real-time practice insights with seamless tracking—empowering you to take control of your search every day.
            </Text>
          </View>
        </AnimatedSection>

        {/* 3. Value Proposition (More Detail) Section */}
        <AnimatedSection scrollY={scrollY} startOffset={1000} endOffset={1200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Everything You Need</Text>
            <View style={styles.featuresGrid}>
              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>🔍</Text>
                <Text style={styles.featureTitle}>Advanced Search</Text>
                <Text style={styles.featureDescription}>
                  Filter by location, price, number of surgeries, and more to find exactly what you're looking for.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>⭐</Text>
                <Text style={styles.featureTitle}>Save Favorites</Text>
                <Text style={styles.featureDescription}>
                  Bookmark listings you're interested in and access them anytime, anywhere.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>🔔</Text>
                <Text style={styles.featureTitle}>Smart Notifications</Text>
                <Text style={styles.featureDescription}>
                  Get notified instantly when new listings match your search preferences.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>💬</Text>
                <Text style={styles.featureTitle}>Direct Inquiries</Text>
                <Text style={styles.featureDescription}>
                  Submit inquiries directly from the app and connect with sellers seamlessly.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>📋</Text>
                <Text style={styles.featureTitle}>Seller Intake</Text>
                <Text style={styles.featureDescription}>
                  Practice owners can easily submit their listings through our streamlined form.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>🗺️</Text>
                <Text style={styles.featureTitle}>Location Maps</Text>
                <Text style={styles.featureDescription}>
                  Visualize practice locations on interactive maps to find the perfect area.
                </Text>
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* 4. Proof/Testimonials Section */}
        <AnimatedSection scrollY={scrollY} startOffset={1800} endOffset={2000}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trusted by Professionals</Text>
            <View style={styles.proofContainer}>
              <View style={styles.proofCard}>
                <Text style={styles.proofNumber}>100+</Text>
                <Text style={styles.proofLabel}>Active Listings</Text>
              </View>
              <View style={styles.proofCard}>
                <Text style={styles.proofNumber}>Expert</Text>
                <Text style={styles.proofLabel}>Industry Knowledge</Text>
              </View>
              <View style={styles.proofCard}>
                <Text style={styles.proofNumber}>Secure</Text>
                <Text style={styles.proofLabel}>Privacy Protected</Text>
              </View>
            </View>
            <View style={styles.trustBox}>
              <Text style={styles.trustTitle}>TRUSTED. EXPERIENCED. STRATEGIC.</Text>
              <Text style={styles.trustDescription}>
                Frank Taylor & Associates brings years of experience in dental practice sales and acquisitions. We support business leaders with a no-nonsense, solution-first approach, helping you navigate the complexities of practice transactions with confidence.
              </Text>
            </View>
          </View>
        </AnimatedSection>

        {/* 5. CTA Section */}
        <AnimatedSection scrollY={scrollY} startOffset={2400} endOffset={2600}>
          <View style={styles.section}>
            <Text style={styles.ctaTitle}>Ready to Get Started?</Text>
            <Text style={styles.ctaDescription}>
              Download the FTA app today and start your journey to finding the perfect dental practice.
            </Text>
            <View style={styles.downloadButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.appStoreButton,
                  (pressed || (isWeb && false)) && styles.buttonPressed,
                ]}
                onPress={handleAppStorePress}>
                <Text style={styles.appStoreText}>Download on the</Text>
                <Text style={styles.appStoreTextBold}>App Store</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.googlePlayButton,
                  (pressed || (isWeb && false)) && styles.buttonPressed,
                ]}
                onPress={handleGooglePlayPress}>
                <Text style={styles.googlePlayText}>GET IT ON</Text>
                <Text style={styles.googlePlayTextBold}>Google Play</Text>
              </Pressable>
            </View>
          </View>
        </AnimatedSection>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Text style={styles.footerDescription}>
              Connecting buyers and sellers of dental practices across the UK.
            </Text>
            <View style={styles.footerLinks}>
              <Pressable onPress={() => handleLinkPress(`mailto:${LINKS.supportEmail}`)}>
                <Text style={styles.footerLink}>Contact</Text>
              </Pressable>
              <Pressable onPress={() => handleLinkPress(LINKS.supportSite)}>
                <Text style={styles.footerLink}>Support</Text>
              </Pressable>
              <Pressable onPress={() => handleLinkPress(LINKS.privacy)}>
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </Pressable>
              <Pressable onPress={() => handleLinkPress(LINKS.terms)}>
                <Text style={styles.footerLink}>Terms</Text>
              </Pressable>
            </View>
            <Text style={styles.footerCopyright}>
              © {new Date().getFullYear()} Frank Taylor & Associates. All rights reserved.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f7f7f7',
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    minHeight: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ui.spacing.xl,
    paddingTop: isWeb ? 80 : 60,
    paddingBottom: 80,
  },
  heroContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 1200,
  },
  logo: {
    width: 220,
    height: 72,
    marginBottom: ui.spacing.xl,
  },
  heroTitle: {
    fontSize: isWeb ? 56 : 36,
    fontWeight: '900',
    textAlign: 'center',
    color: '#000',
    marginBottom: ui.spacing.xl * 2,
    lineHeight: isWeb ? 64 : 44,
  },
  phoneContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ui.spacing.xl,
  },
  phoneFrame: {
    backgroundColor: '#1a1a1a',
    borderRadius: 40,
    padding: 10,
    ...ui.shadow.card,
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  phoneNotch: {
    width: 140,
    height: 28,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    alignSelf: 'center',
    marginBottom: 6,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000',
  },
  phoneScreenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ui.spacing.lg,
    backgroundColor: '#f7f7f7',
  },
  phoneScreenImage: {
    width: '80%',
    height: '60%',
    marginBottom: ui.spacing.md,
  },
  phoneScreenText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  phoneHomeIndicator: {
    width: 130,
    height: 5,
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
  },
  floatingShape: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.1,
  },
  shape1: {
    width: 200,
    height: 200,
    backgroundColor: Colors.light.tint,
    top: 100,
    left: 50,
  },
  shape2: {
    width: 150,
    height: 150,
    backgroundColor: Colors.light.tint,
    top: 300,
    right: 80,
  },
  shape3: {
    width: 180,
    height: 180,
    backgroundColor: Colors.light.tint,
    bottom: 200,
    left: 100,
  },
  section: {
    paddingHorizontal: isWeb ? ui.spacing.xl * 2 : ui.spacing.xl,
    paddingVertical: isWeb ? ui.spacing.xl * 3 : ui.spacing.xl * 2,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: isWeb ? 42 : 32,
    fontWeight: '900',
    textAlign: 'center',
    color: '#000',
    marginBottom: ui.spacing.lg,
  },
  sectionDescription: {
    fontSize: isWeb ? 20 : 18,
    textAlign: 'center',
    color: '#000',
    opacity: 0.8,
    lineHeight: isWeb ? 32 : 28,
    marginBottom: ui.spacing.md,
  },
  sectionSubtext: {
    fontSize: isWeb ? 16 : 14,
    textAlign: 'center',
    color: '#000',
    opacity: 0.7,
    lineHeight: isWeb ? 24 : 20,
  },
  featuresGrid: {
    flexDirection: isWeb ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: ui.spacing.lg,
    marginTop: ui.spacing.xl,
    justifyContent: 'center',
  },
  featureCard: {
    flex: isWeb ? 1 : undefined,
    minWidth: isWeb ? 280 : '100%',
    maxWidth: isWeb ? 350 : '100%',
    backgroundColor: '#fff',
    borderRadius: ui.radius.lg,
    padding: ui.spacing.xl,
    ...ui.shadow.card,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: ui.spacing.md,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    marginBottom: ui.spacing.sm,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#000',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  proofContainer: {
    flexDirection: isWeb ? 'row' : 'column',
    gap: ui.spacing.lg,
    marginTop: ui.spacing.xl,
    justifyContent: 'center',
  },
  proofCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: ui.radius.lg,
    padding: ui.spacing.xl,
    alignItems: 'center',
    ...ui.shadow.card,
    minWidth: isWeb ? 200 : '100%',
  },
  proofNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.light.tint,
    marginBottom: ui.spacing.sm,
  },
  proofLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    opacity: 0.8,
    textAlign: 'center',
  },
  trustBox: {
    backgroundColor: '#fff',
    borderRadius: ui.radius.lg,
    padding: ui.spacing.xl,
    marginTop: ui.spacing.xl,
    ...ui.shadow.card,
  },
  trustTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginBottom: ui.spacing.md,
    textAlign: 'center',
    letterSpacing: 1,
  },
  trustDescription: {
    fontSize: 16,
    color: '#000',
    opacity: 0.8,
    lineHeight: 24,
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: isWeb ? 48 : 36,
    fontWeight: '900',
    textAlign: 'center',
    color: '#000',
    marginBottom: ui.spacing.md,
  },
  ctaDescription: {
    fontSize: isWeb ? 20 : 18,
    textAlign: 'center',
    color: '#000',
    opacity: 0.8,
    marginBottom: ui.spacing.xl * 2,
    lineHeight: isWeb ? 32 : 28,
  },
  downloadButtons: {
    flexDirection: isWeb ? 'row' : 'column',
    gap: ui.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  appStoreButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isWeb ? 200 : '100%',
    maxWidth: isWeb ? 220 : '100%',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    }),
    ...ui.shadow.card,
  },
  appStoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  appStoreTextBold: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  googlePlayButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isWeb ? 200 : '100%',
    maxWidth: isWeb ? 220 : '100%',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    }),
    ...ui.shadow.card,
  },
  googlePlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  googlePlayTextBold: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  footer: {
    backgroundColor: '#000',
    paddingVertical: ui.spacing.xl * 2,
    paddingHorizontal: ui.spacing.xl,
    marginTop: ui.spacing.xl * 2,
  },
  footerContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: ui.spacing.md,
  },
  footerDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: ui.spacing.lg,
  },
  footerLinks: {
    flexDirection: isWeb ? 'row' : 'column',
    gap: ui.spacing.lg,
    marginBottom: ui.spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLink: {
    color: Colors.light.tint,
    fontSize: 14,
    fontWeight: '700',
    ...(isWeb && {
      cursor: 'pointer',
      textDecorationLine: 'underline',
    }),
  },
  footerCopyright: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.5,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
