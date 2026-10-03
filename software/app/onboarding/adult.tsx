import { router } from 'expo-router';
import { Text } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { useUserData } from '@/components/UserDataProvider';
import { saveAdultGate } from '@/modules/app-core/user-data';
import { useTheme } from '@/design-system';

export default function AdultGateScreen() {
  const { db, refresh } = useUserData();
  const { colors, typography } = useTheme();

  return (
    <OnboardingShell
      title="Confirm you are an adult"
      subtitle="This app is for adults 18+. Adaptive coaching (later) stays off until clinical review; exclusions can disable the coaching shell."
      primaryLabel="I am 18 or older"
      onPrimary={() => {
        if (!db) return;
        saveAdultGate(db, true);
        refresh();
        router.push('/onboarding/units');
      }}
      secondaryLabel="I am under 18"
      onSecondary={() => {
        if (!db) return;
        saveAdultGate(db, false);
        refresh();
      }}
    >
      <Text style={[typography.body, { color: colors.ink }]}>
        Targets are estimates for personal tracking, not medical advice.
      </Text>
    </OnboardingShell>
  );
}
