import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  paletteFor,
  Spacing,
  Radius,
  Typography,
  type AppPalette,
  type ColorSchemeName,
} from '../tokens';

export type Theme = {
  scheme: ColorSchemeName;
  colors: AppPalette;
  spacing: typeof Spacing;
  radius: typeof Radius;
  typography: typeof Typography;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  children: React.ReactNode;
  /** Force light/dark for gallery previews; omit to follow system. */
  forcedScheme?: ColorSchemeName;
};

export function ThemeProvider({ children, forcedScheme }: Props) {
  const system = useColorScheme();
  const scheme: ColorSchemeName =
    forcedScheme ?? (system === 'dark' ? 'dark' : 'light');

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      colors: paletteFor(scheme),
      spacing: Spacing,
      radius: Radius,
      typography: Typography,
    }),
    [scheme],
  );

  // Keep native status / navigation chrome in sync with the active palette
  // so System/Light/Dark switches never leave mixed-theme surfaces (#80).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.canvas);
  }, [theme.colors.canvas]);

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar
        style={scheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={Platform.OS === 'android' ? theme.colors.canvas : undefined}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
