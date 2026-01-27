import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LiquidGlassTabBarBackground } from '@/src/ui/components/LiquidGlassTabBarBackground';
import { ui } from '@/src/ui/theme';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Force light mode for the tab bar
  const scheme = 'light' as 'light' | 'dark';
  const tabBarHeight = 66;
  // Give the tab bar a little breathing room above the bottom edge (especially on Android).
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const tabBarHorizontalInset = ui.layout.tabBarInsetX;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[scheme].tabIconSelected,
        tabBarInactiveTintColor: Colors[scheme].tabIconDefault,
        tabBarBackground: () => <LiquidGlassTabBarBackground colorScheme={scheme} />,
        tabBarStyle: {
          borderTopWidth: 0,
          position: 'absolute',
          left: 0,
          right: 0,
          marginHorizontal: tabBarHorizontalInset,
          bottom: tabBarBottom,
          height: tabBarHeight,
          borderRadius: ui.radius.lg,
          backgroundColor: 'transparent',
          ...ui.shadow.card,
        },
        tabBarLabelStyle: { fontWeight: '800', fontSize: 12 },
        tabBarItemStyle: { paddingTop: 6 },
        // Hide the header entirely so there is no empty gap at the top of each tab screen.
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <TabBarIcon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
