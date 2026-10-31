import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Appearance, Platform, View } from 'react-native';
import {
  ThemeProvider,
  useTheme,
  useProductFonts,
} from '@/design-system';
import { UserDataProvider, useUserData } from '@/components/UserDataProvider';
import { FoodCatalogProvider } from '@/components/FoodCatalogProvider';
import {
  initializeNativeThemePreference,
  readStartupThemePreference,
  writeWebStartupThemePreference,
  type ThemePreference,
} from '@/modules/app-core/settings';

let appliedThemePreference: ThemePreference | null = null;

function applyNativeThemePreference(themePreference: ThemePreference) {
  if (Platform.OS === 'web' || appliedThemePreference === themePreference) return;
  Appearance.setColorScheme(themePreference === 'system' ? null : themePreference);
  appliedThemePreference = themePreference;
}

if (Platform.OS !== 'web') {
  try {
    // Read the small persisted setting synchronously so a forced scheme is in
    // place while the native splash is still covering startup hydration.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLite = require('expo-sqlite') as {
      openDatabaseSync: Parameters<typeof readStartupThemePreference>[0];
    };
    initializeNativeThemePreference(SQLite.openDatabaseSync, applyNativeThemePreference);
  } catch {
    applyNativeThemePreference('system');
  }
}
void SplashScreen.preventAutoHideAsync();

function PersistedTheme({ children }: { children: React.ReactNode }) {
  const { ready, themePreference } = useUserData();

  useEffect(() => {
    if (!ready) return;
    writeWebStartupThemePreference(themePreference);
    applyNativeThemePreference(themePreference);
    void SplashScreen.hideAsync();
  }, [ready, themePreference]);

  if (!ready) {
    // Native remains behind its theme-neutral splash. Web has no native splash,
    // so synchronously paint the last persisted scheme while sql.js hydrates.
    if (Platform.OS !== 'web') return null;
    // +html sets this before first paint, including static exports. Keep the
    // server and client markup identical so hydration cannot flash a light fill.
    return <View style={{ flex: 1, backgroundColor: 'var(--startup-canvas)' }} />;
  }

  return (
    <ThemeProvider forcedScheme={themePreference === 'system' ? undefined : themePreference}>
      {children}
    </ThemeProvider>
  );
}

function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  // Start Figtree/Nunito loading during hydration; never gates render (issue 120).
  useProductFonts();
  return (
    <UserDataProvider>
      <PersistedTheme>
        <FoodCatalogProvider>
          <AppStack />
        </FoodCatalogProvider>
      </PersistedTheme>
    </UserDataProvider>
  );
}
