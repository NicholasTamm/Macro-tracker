import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import type { AppPalette, ColorSchemeName } from '../tokens/colors';

/** Keep navigation's scene containers and default header borders on app tokens. */
export function navigationThemeFor(scheme: ColorSchemeName, palette: AppPalette): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.brand,
      background: palette.canvas,
      card: palette.raised,
      text: palette.ink,
      border: palette.divider,
      notification: palette.danger,
    },
  };
}
