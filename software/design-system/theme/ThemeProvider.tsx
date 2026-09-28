import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
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

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
