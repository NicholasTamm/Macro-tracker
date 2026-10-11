import { Stack } from 'expo-router';
import { useTheme } from '@/design-system';
import { HeaderBackButton } from '@/components/HeaderBackButton';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerBackVisible: false,
        headerLeft: ({ tintColor }) => (
          <HeaderBackButton
            destination="/settings"
            label="Back to Settings"
            tintColor={tintColor ?? colors.ink}
          />
        ),
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
