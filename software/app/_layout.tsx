import { Stack } from 'expo-router';
import { ThemeProvider } from '@/design-system';
import { UserDataProvider } from '@/components/UserDataProvider';
import { FoodCatalogProvider } from '@/components/FoodCatalogProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <UserDataProvider>
        <FoodCatalogProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </FoodCatalogProvider>
      </UserDataProvider>
    </ThemeProvider>
  );
}
