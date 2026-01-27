import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import Colors from '@/constants/Colors';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';

export function PrimaryButton({
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
  // Use website gold color #F8C859 for buttons
  const backgroundColor = '#F8C859';
  const textColor = '#0b0f1a';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.btn, { backgroundColor }, disabled && styles.btnDisabled, style]}>
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

