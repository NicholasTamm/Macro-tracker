import { Stack } from 'expo-router';
import { useTheme } from '@/design-system';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="units" options={{ title: 'Units & appearance' }} />
      <Stack.Screen name="about" options={{ title: 'About & data sources' }} />
      <Stack.Screen name="licenses" options={{ title: 'Open-source licenses' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
    </Stack>
  );
}
