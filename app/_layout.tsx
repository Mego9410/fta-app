import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { initDb } from '@/src/data/db';

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

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
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
    if (dbError) throw dbError;
  }, [dbError]);

  if (!loaded || !dbReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
