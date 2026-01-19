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
  const theme = useColorScheme() ?? 'light';
  const bg = selected
    ? Colors[theme].tint
    : theme === 'dark'
      ? 'rgba(255,255,255,0.10)'
      : 'rgba(0,0,0,0.05)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const textColor = selected ? '#0b0f1a' : Colors[theme].text;

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

