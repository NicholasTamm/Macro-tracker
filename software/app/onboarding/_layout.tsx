import { Stack } from 'expo-router';
import { useTheme } from '@/design-system';
import { HeaderBackButton } from '@/components/HeaderBackButton';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerBackVisible: false,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Welcome', headerLeft: () => null }} />
      <Stack.Screen name="adult" options={{ title: 'Age confirmation', headerLeft: ({ tintColor }) => <HeaderBackButton label="Back to Welcome" tintColor={tintColor ?? colors.ink} /> }} />
      <Stack.Screen name="units" options={{ title: 'Units', headerLeft: ({ tintColor }) => <HeaderBackButton label="Back to Age confirmation" tintColor={tintColor ?? colors.ink} /> }} />
      <Stack.Screen name="biometrics" options={{ title: 'About you', headerLeft: ({ tintColor }) => <HeaderBackButton label="Back to Units" tintColor={tintColor ?? colors.ink} /> }} />
      <Stack.Screen name="goal" options={{ title: 'Goal', headerLeft: ({ tintColor }) => <HeaderBackButton label="Back to About you" tintColor={tintColor ?? colors.ink} /> }} />
      <Stack.Screen name="exclusions" options={{ title: 'Safety exclusions', headerLeft: ({ tintColor }) => <HeaderBackButton label="Back to Goal" tintColor={tintColor ?? colors.ink} /> }} />
      <Stack.Screen name="target" options={{ title: 'Starter target', headerLeft: ({ tintColor }) => <HeaderBackButton label="Back to Safety exclusions" tintColor={tintColor ?? colors.ink} /> }} />
    </Stack>
  );
}
