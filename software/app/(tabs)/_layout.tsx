import { Tabs } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system';

export default function TabsLayout() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const iconHeight = spacing.xl + spacing.xs;
  // Include the caption's full line box, room for the tab button's padding,
  // the top border, and the home indicator. Navigation reserves this height.
  const tabBarHeight = iconHeight + typography.caption.lineHeight! + spacing.sm * 2 + 1 + insets.bottom;

  return (
    <Tabs
      // Web tab visits must append browser history. The default firstRoute
      // invents a Today entry on deep links, so tapping Today looks like a pop.
      backBehavior={Platform.OS === 'web' ? 'fullHistory' : 'firstRoute'}
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: typography.caption,
        tabBarIconStyle: { height: iconHeight },
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          backgroundColor: colors.raised,
          borderTopColor: colors.divider,
        },
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerTitleStyle: typography.pageTitle,
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
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            // Tab routes retain params; a fresh Search tab visit always logs today.
            event.preventDefault();
            navigation.navigate('food-entry', { date: undefined });
          },
        })}
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
