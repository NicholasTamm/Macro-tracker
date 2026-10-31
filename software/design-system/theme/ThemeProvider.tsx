import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme, type TextStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import {
  paletteFor,
  Spacing,
  Radius,
  typographyFor,
  weightStyle,
  type TypographyScale,
  type AppPalette,
  type ColorSchemeName,
} from '../tokens';
import { syncNativeChrome } from './nativeChrome';
import { useProductFonts } from '../fonts';

export type Theme = {
  scheme: ColorSchemeName;
  colors: AppPalette;
  spacing: typeof Spacing;
  radius: typeof Radius;
  typography: TypographyScale;
  /** True once Figtree/Nunito are loaded; system faces until then or on failure. */
  fontsLoaded: boolean;
  /** Weight override on the product face — use instead of raw fontWeight. */
  font: (weight: TextStyle['fontWeight']) => Pick<TextStyle, 'fontWeight' | 'fontFamily'>;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  children: React.ReactNode;
  /** Force light/dark for gallery previews; omit to follow system. */
  forcedScheme?: ColorSchemeName;
};

export function ThemeProvider({ children, forcedScheme }: Props) {
  const parentTheme = useContext(ThemeContext);
  const system = useColorScheme();
  const scheme: ColorSchemeName =
    forcedScheme ?? (system === 'dark' ? 'dark' : 'light');
  // Non-blocking: render with system faces now, swap to Figtree/Nunito when
  // ready. Fixed lineHeights keep the swap reflow-free (issue 120).
  const fontsLoaded = useProductFonts();

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      colors: paletteFor(scheme),
      spacing: Spacing,
      radius: Radius,
      typography: typographyFor(fontsLoaded),
      fontsLoaded,
      font: (weight) => weightStyle(weight, fontsLoaded),
    }),
    [scheme, fontsLoaded],
  );

  // Keep native status / navigation chrome in sync with the active palette
  // so System/Light/Dark switches never leave mixed-theme surfaces (#80).
  // Nested preview providers must not overwrite app-global chrome.
  useEffect(() => {
    if (parentTheme) return;
    void syncNativeChrome(Platform.OS, scheme, theme.colors.canvas, {
      setRootBackgroundColor: SystemUI.setBackgroundColorAsync,
      setNavigationButtonStyle: NavigationBar.setButtonStyleAsync,
    });
  }, [parentTheme, scheme, theme.colors.canvas]);

  return (
    <ThemeContext.Provider value={theme}>
      {!parentTheme && (
        <StatusBar
          style={scheme === 'dark' ? 'light' : 'dark'}
          backgroundColor={Platform.OS === 'android' ? theme.colors.canvas : undefined}
        />
      )}
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
