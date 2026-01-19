import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { LiquidGlassBackButton } from '@/src/ui/components/LiquidGlassBackButton';
import { ui } from '@/src/ui/theme';

export function ScreenHeader({
  title,
  subtitle,
  mode = 'stack',
  fallbackHref,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  /** 'stack' screens already get safe-area padding from RootLayout; 'tabs' screens do not. */
  mode?: 'stack' | 'tabs';
  fallbackHref?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const paddingTop = mode === 'tabs' ? insets.top + ui.spacing.lg : ui.spacing.lg;

  return (
    <View style={[styles.wrap, { paddingTop }, style]}>
      <View style={styles.row}>
        <LiquidGlassBackButton
          fallbackHref={fallbackHref}
          forceShow={!!fallbackHref}
          style={styles.backInline}
        />

        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingBottom: ui.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backInline: {
    position: 'relative',
    left: 0,
    top: 0,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.75,
  },
  right: {
    marginLeft: 6,
  },
});

