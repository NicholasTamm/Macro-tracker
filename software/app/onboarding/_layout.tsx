import { Stack } from 'expo-router';
import { useTheme } from '@/design-system';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Welcome' }} />
      <Stack.Screen name="adult" options={{ title: 'Age confirmation' }} />
      <Stack.Screen name="units" options={{ title: 'Units' }} />
      <Stack.Screen name="biometrics" options={{ title: 'About you' }} />
      <Stack.Screen name="goal" options={{ title: 'Goal' }} />
      <Stack.Screen name="exclusions" options={{ title: 'Safety exclusions' }} />
      <Stack.Screen name="target" options={{ title: 'Starter target' }} />
    </Stack>
  );
}
