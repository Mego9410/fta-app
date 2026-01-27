import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';

export function SecondaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const theme = useColorScheme() ?? 'light';
  // White background with gold border and gold text (website style)
  const backgroundColor = '#FFFFFF';
  const borderColor = '#F8C859';
  const textColor = '#F8C859';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.btn, { backgroundColor, borderColor, borderWidth: 1 }, disabled && styles.btnDisabled, style]}>
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  text: { fontSize: 16, fontWeight: '800' },
});

