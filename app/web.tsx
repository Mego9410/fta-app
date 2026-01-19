import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useColorScheme } from '@/components/useColorScheme';
import { LiquidGlassBackButton } from '@/src/ui/components/LiquidGlassBackButton';
import { ui } from '@/src/ui/theme';

export default function WebScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const theme = useColorScheme() ?? 'light';

  const safeUrl = useMemo(() => (typeof url === 'string' ? url : ''), [url]);
  const safeTitle = useMemo(() => (typeof title === 'string' ? title : 'Web'), [title]);

  return (
    <View style={styles.container}>
      {safeUrl ? <WebView source={{ uri: safeUrl }} style={{ flex: 1 }} /> : null}
      {/* WebView can draw above siblings; keep back button LAST so it always overlays. */}
      <LiquidGlassBackButton accessibilityLabel={`Back from ${safeTitle}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

