import { Stack } from 'expo-router';
import { ThemeProvider } from '@/design-system';
import { UserDataProvider } from '@/components/UserDataProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <UserDataProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </UserDataProvider>
    </ThemeProvider>
  );
}
