import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { ThemeProvider } from '@/design-system';
import { UserDataProvider, useUserData } from '@/components/UserDataProvider';
import { FoodCatalogProvider } from '@/components/FoodCatalogProvider';
import {
  initializeNativeThemePreference,
  readStartupThemePreference,
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
    applyNativeThemePreference(themePreference);
    void SplashScreen.hideAsync();
  }, [ready, themePreference]);

  if (!ready) return null;

  return (
    <ThemeProvider forcedScheme={themePreference === 'system' ? undefined : themePreference}>
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <UserDataProvider>
      <PersistedTheme>
        <FoodCatalogProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
          </Stack>
        </FoodCatalogProvider>
      </PersistedTheme>
    </UserDataProvider>
  );
}
