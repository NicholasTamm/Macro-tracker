import { Tabs } from 'expo-router';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import React from "react"


export default function RootLayout() {

  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#007AFF'
    }}>
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => <Feather name="book-open" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="food-entry"
        options={{
          title: 'Food Entry',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="restaurant-menu" size={size} color={color} />,
        }}
     />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
