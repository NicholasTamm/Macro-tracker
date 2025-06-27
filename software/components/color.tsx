import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

const colors = {
  lightTheme: {
    mode: 'light',
    colors: {
      background: '#FFFFFF',
      text: '#1A1A1A',
      primary: '#000000',
      border: '#E2E2E2',
      destructive: '#E24444',
      icon: '#1A1A1A',
    },
  },
  darkTheme: {
    mode: 'dark',
    colors: {
      background: '#181818',
      text: '#FFFFFF',
      primary: '#FFFFFF',
      card: '#232323',
      border: '#333333',
      destructive: '#FF5A5F',
      icon: '#FFFFFF',
    },
  },
}

export default colors

