import { ThemeProvider } from '@react-navigation/native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '@/design-system';
import { navigationThemeFor } from '@/design-system/theme/navigationTheme';

export function NavigationThemeProvider({ children }: { children: ReactNode }) {
  const { scheme, colors } = useTheme();
  const theme = useMemo(() => navigationThemeFor(scheme, colors), [scheme, colors]);
  return <ThemeProvider value={theme}>{children}</ThemeProvider>;
}
