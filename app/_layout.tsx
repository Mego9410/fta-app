import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/components/useColorScheme';
import { Text } from '@/components/Themed';
import { initDb } from '@/src/data/db';
import { maybeSyncListingsFromWebsite } from '@/src/data/listingsSync';
import { flushOutbox } from '@/src/data/outboxRepo';
import { registerBackgroundFetch } from '@/src/data/backgroundTask';
import { setupNotificationHandlers } from '@/src/notifications/notifications';
import { isSupabaseRequiredButMissing } from '@/src/supabase/client';
import { initTelemetry } from '@/src/telemetry';
import { ui } from '@/src/ui/theme';
import { LoadingScreen } from '@/src/ui/components/LoadingScreen';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<unknown>(null);
  const [showConfigError, setShowConfigError] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    // Skip database initialization on web (SQLite doesn't work on web)
    if (Platform.OS === 'web') {
      setDbReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await initDb();
        if (!cancelled) setDbReady(true);
      } catch (e) {
        if (!cancelled) setDbError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  useEffect(() => {
    if (!loaded || !dbReady) return;
    // Skip app-specific initialization on web
    if (Platform.OS === 'web') return;

    // Background listings sync (throttled) so users see fresh listings without Admin action.
    maybeSyncListingsFromWebsite().catch(() => {
      // best-effort: keep cached listings if it fails
    });
    flushOutbox().catch(() => {
      // best-effort: will retry next time the app becomes active
    });
    // Register background fetch task for new listing notifications
    registerBackgroundFetch().catch(() => {
      // best-effort: background fetch may not be available on all platforms
    });
    // Initialize telemetry with error handling (SecureStore may fail during background refresh)
    try {
      initTelemetry();
    } catch (error) {
      // Silently fail - telemetry is non-critical
      console.warn('Telemetry initialization failed:', error);
    }
  }, [dbReady, loaded]);

  useEffect(() => {
    // Skip AppState listener on web
    if (Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flushOutbox().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Set up notification handlers
  useEffect(() => {
    // Skip notification handlers on web
    if (Platform.OS === 'web') return;

    const unsubscribe = setupNotificationHandlers(
      // Handle notifications received while app is foregrounded
      (notification) => {
        console.log('Notification received:', notification);
      },
      // Handle user tapping on a notification
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'new_listing' && data?.listingId) {
          router.push(`/listings/${data.listingId}`);
        }
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (dbError) throw dbError;
  }, [dbError]);

  if (!loaded || !dbReady) {
    return <LoadingScreen />;
  }

  // Skip Supabase check on web (landing page doesn't need it)
  if (Platform.OS !== 'web' && isSupabaseRequiredButMissing) {
    return (
      <View style={styles.misconfigPage}>
        <Text style={styles.misconfigTitle}>App configuration error</Text>
        <Text style={styles.misconfigBody}>
          This build is missing required server configuration. Please contact support or reinstall a production build.
        </Text>
        <Pressable style={styles.misconfigBtn} onPress={() => setShowConfigError((v) => !v)}>
          <Text style={styles.misconfigBtnText}>{showConfigError ? 'Hide details' : 'Show details'}</Text>
        </Pressable>
        {showConfigError ? (
          <Text style={styles.misconfigDetails}>
            Missing: EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY
          </Text>
        ) : null}
      </View>
    );
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          // Hide the header entirely so there is no empty gap at the top of stack screens.
          headerShown: false,
          // Re-introduce safe-area spacing at the top now that the header is hidden.
          contentStyle: { paddingTop: insets.top },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false, contentStyle: { paddingTop: 0 } }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { paddingTop: 0 } }} />
        <Stack.Screen name="listings/[id]" />
        <Stack.Screen name="inquire/[id]" />
        <Stack.Screen name="sell/index" />
        <Stack.Screen name="articles" />
        <Stack.Screen name="article" />
        <Stack.Screen name="testimonials/index" />
        <Stack.Screen name="testimonials/[id]" />
        <Stack.Screen name="web" />
        <Stack.Screen name="swipe" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  misconfigPage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingVertical: ui.layout.screenPaddingY,
    gap: ui.spacing.md,
  },
  misconfigTitle: { fontSize: 22, fontWeight: '900' },
  misconfigBody: { fontSize: 14, opacity: 0.75, lineHeight: 20, fontWeight: '600' },
  misconfigBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  misconfigBtnText: { fontSize: 13, fontWeight: '800' },
  misconfigDetails: { fontSize: 12, opacity: 0.7, fontWeight: '700' },
});
