import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { useUserData } from '@/components/UserDataProvider';
import { saveAdultGate } from '@/modules/app-core/user-data';
import { useTheme } from '@/design-system';

export default function AdultGateScreen() {
  const { db, refresh } = useUserData();
  const { colors, typography, spacing } = useTheme();
  const [under18Note, setUnder18Note] = useState(false);

  return (
    <OnboardingShell
      title="Confirm you are an adult"
      subtitle="This app is for adults 18+. Adaptive coaching (later) stays off until clinical review; exclusions can disable the coaching shell."
      primaryLabel="I am 18 or older"
      onPrimary={() => {
        if (!db) return;
        setUnder18Note(false);
        saveAdultGate(db, true);
        refresh();
        router.push('/onboarding/units');
      }}
      secondaryLabel="I am under 18"
      onSecondary={() => {
        if (!db) return;
        saveAdultGate(db, false);
        refresh();
        setUnder18Note(true);
      }}
    >
      <Text style={[typography.body, { color: colors.ink }]}>
        Targets are estimates for personal tracking, not medical advice.
      </Text>
      {under18Note ? (
        <Text
          style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}
          accessibilityLiveRegion="polite"
        >
          Under-18 confirmed: onboarding cannot finish and the coaching shell stays disabled.
        </Text>
      ) : null}
    </OnboardingShell>
  );
}
