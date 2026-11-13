// app/(tabs)/_layout.tsx
// Bottom tab navigation layout for Lists, Household, and Settings.
// Styled with explicit heights, insets, and clear iconography.

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTheme } from '@/ui/theme';

export default function TabLayout(): React.ReactElement {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lists',
          tabBarLabel: 'Lists',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarLabel: 'Household',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 26 : 8,
    paddingTop: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  tabBarIcon: {
    marginTop: 2,
  },
});
