import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ui } from '@/src/ui/theme';

export function LiquidGlassBackButton({
  style,
  onPress,
  accessibilityLabel,
  fallbackHref,
  forceShow,
}: {
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
  fallbackHref?: string;
  forceShow?: boolean;
}) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const isDark = scheme === 'dark';

  // Show when the stack can go back, or when explicitly forced, or when a fallback is provided.
  const canGoBack = router.canGoBack();
  const shouldShow = !!forceShow || canGoBack || !!fallbackHref;
  if (!shouldShow) return null;

  const overlayColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.60)';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const goldGlow = isDark ? 'rgba(228,173,37,0.12)' : 'rgba(228,173,37,0.10)';
  const fallbackTint = isDark ? Colors.dark.background : Colors.light.background;
  const iconColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.80)';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Back'}
      onPress={
        onPress ??
        (() => {
          if (canGoBack) {
            router.back();
            return;
          }
          if (fallbackHref) {
            router.replace(fallbackHref as any);
          }
        })
      }
      style={[styles.wrap, style]}>
      <View pointerEvents="none" style={styles.bg}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={35} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackTint, opacity: 0.12 }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
        {/* Keep the “warmth” uniform to avoid a two-tone/half-dark appearance. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: goldGlow }]} />
        <View style={[StyleSheet.absoluteFill, styles.border, { borderColor }]} />
      </View>

      <FontAwesome name="chevron-left" size={16} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: ui.layout.screenPaddingX,
    top: ui.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: ui.radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 12,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: ui.radius.pill,
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ui.radius.pill,
  },
});

