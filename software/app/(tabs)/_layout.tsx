import { Tabs } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { useTheme } from '@/design-system';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.raised,
          borderTopColor: colors.divider,
        },
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarAccessibilityLabel: 'Today',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="sun" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarAccessibilityLabel: 'Analytics',
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="food-entry"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search foods',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="restaurant-menu" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="component-gallery"
        options={{
          href: __DEV__ ? '/component-gallery' : null,
          title: 'Gallery',
          tabBarAccessibilityLabel: 'Component gallery',
          tabBarIcon: ({ color, size }) => (
            <Feather name="layers" size={size} color={color} />
          ),
        }}
      />
      {/* Legacy placeholder — hide from tab bar; route kept only if linked */}
      <Tabs.Screen
        name="journal"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
