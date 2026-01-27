import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ui } from '@/src/ui/theme';

export function Chip({ label }: { label: string }) {
  // Dark grey background with white text
  const backgroundColor = '#666666';
  const borderColor = '#666666';
  return (
    <View style={[styles.chip, { backgroundColor, borderColor }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

