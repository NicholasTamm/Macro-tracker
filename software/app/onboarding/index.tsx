import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useUserData } from '@/components/UserDataProvider';
import { useTheme } from '@/design-system';

const STEP_ROUTE: Record<string, string> = {
  adult: '/onboarding/adult',
  units: '/onboarding/units',
  biometrics: '/onboarding/biometrics',
  goal: '/onboarding/goal',
  exclusions: '/onboarding/exclusions',
  target: '/onboarding/target',
  done: '/food-entry',
};

export default function OnboardingIndex() {
  const { ready, snapshot, error } = useUserData();
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} accessibilityLabel="Loading onboarding" />
      </View>
    );
  }
  if (error || !snapshot) {
    return <Redirect href="/onboarding/adult" />;
  }
  if (snapshot.complete) {
    return <Redirect href="/food-entry" />;
  }
  const href = STEP_ROUTE[snapshot.profile.onboardingStep] ?? '/onboarding/adult';
  return <Redirect href={href as '/onboarding/adult'} />;
}
