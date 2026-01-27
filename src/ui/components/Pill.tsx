import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import Colors from '@/constants/Colors';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ui } from '@/src/ui/theme';

export function Pill({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  // Gold accent for selected state (website style)
  // Light theme only - visible grey for unselected
  const bg = selected ? '#E4AD25' : '#E5E5E5';
  const borderColor = selected ? '#E4AD25' : '#CCCCCC';
  const textColor = selected ? '#0b0f1a' : '#000000';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: bg, borderColor }, style]}>
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: ui.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.95,
  },
});

