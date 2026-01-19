import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import Colors from '@/constants/Colors';
import { ui } from '@/src/ui/theme';

type Props = {
  colorScheme: 'light' | 'dark';
  radius?: number;
};

/**
 * Tab bar “liquid glass” background:
 * - iOS: real blur + subtle overlay + hairline border
 * - Android/Web: translucent overlay + hairline border (blur not reliable)
 */
export function LiquidGlassTabBarBackground({ colorScheme, radius = ui.radius.lg }: Props) {
  const isDark = colorScheme === 'dark';

  const overlayColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.60)';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const goldGlow = isDark ? 'rgba(228,173,37,0.10)' : 'rgba(228,173,37,0.08)';
  const fallbackTint = isDark ? Colors.dark.background : Colors.light.background;

  return (
    <View pointerEvents="none" style={[styles.root, { borderRadius: radius }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={35}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackTint, opacity: 0.12 }]} />
      )}

      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />

      {/* Subtle “liquid” warmth */}
      <View style={[styles.glow, { backgroundColor: goldGlow }]} />

      {/* Hairline edge */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderColor, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    left: -28,
    right: -28,
    top: -18,
    height: 56,
    borderRadius: 999,
    opacity: 0.9,
  },
});

