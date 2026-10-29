import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { ThemeProvider } from '@/design-system';
import { UserDataProvider, useUserData } from '@/components/UserDataProvider';
import { FoodCatalogProvider } from '@/components/FoodCatalogProvider';

void SplashScreen.preventAutoHideAsync();

function PersistedTheme({ children }: { children: React.ReactNode }) {
  const { ready, themePreference } = useUserData();

  useEffect(() => {
    if (!ready) return;
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(themePreference === 'system' ? null : themePreference);
    }
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
