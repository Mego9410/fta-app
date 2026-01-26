import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, Pressable, View } from 'react-native';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { ui } from '@/src/ui/theme';

export function SwipeActionButtons({
  onLike,
  onDislike,
  onSuperlike,
  disabled,
}: {
  onLike: () => void;
  onDislike: () => void;
  onSuperlike: () => void;
  disabled?: boolean;
}) {
  const theme = useColorScheme() ?? 'light';
  const bg = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, styles.dislikeButton, { backgroundColor: bg, borderColor }, disabled && styles.disabled]}
        onPress={onDislike}
        disabled={disabled}>
        <FontAwesome name="times" size={24} color="#ef4444" />
      </Pressable>

      <Pressable
        style={[styles.button, styles.superlikeButton, { backgroundColor: bg, borderColor }, disabled && styles.disabled]}
        onPress={onSuperlike}
        disabled={disabled}>
        <FontAwesome name="star" size={24} color="#3b82f6" />
      </Pressable>

      <Pressable
        style={[styles.button, styles.likeButton, { backgroundColor: bg, borderColor }, disabled && styles.disabled]}
        onPress={onLike}
        disabled={disabled}>
        <FontAwesome name="heart" size={24} color="#22c55e" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    ...ui.shadow.card,
  },
  dislikeButton: {},
  superlikeButton: {},
  likeButton: {},
  disabled: {
    opacity: 0.5,
  },
});
