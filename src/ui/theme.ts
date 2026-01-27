export const ui = {
  radius: {
    sm: 12,
    md: 16,
    lg: 22,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
  // App-wide layout tokens (single source of truth for screen padding/gutters).
  layout: {
    // Match the Tabs `sceneContainerStyle` horizontal gutters.
    screenPaddingX: 16,
    // Used by many screens historically (v1) for vertical breathing room.
    screenPaddingY: 16,
    // Horizontal inset for the floating bottom tab bar ("menu bar") only.
    // Smaller value = wider tab bar (closer to screen edges).
    tabBarInsetX: 50,
  },
  shadow: {
    // RN cross-platform-ish "soft card" shadow - subtle like website
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  },
};
