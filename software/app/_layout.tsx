import { Stack } from 'expo-router';
import { ThemeProvider, useProductFonts } from '@/design-system';
import { UserDataProvider, useUserData } from '@/components/UserDataProvider';
import { FoodCatalogProvider } from '@/components/FoodCatalogProvider';

function PersistedTheme({ children }: { children: React.ReactNode }) {
  const { themePreference } = useUserData();
  // Kick off MacroSans load; fixed lineHeights keep layout stable before/after.
  useProductFonts();
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
