import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { ui } from '@/src/ui/theme';

export function TabPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingBottom: ui.spacing.md,
    gap: 2,
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
});
