import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { useUserData } from '@/components/UserDataProvider';
import {
  completeOnboardingWithStarterTarget,
  computeStarterTarget,
} from '@/modules/app-core/user-data';
import { isCoachingShellEntryEnabled } from '@/modules/coaching';
import { useTheme } from '@/design-system';

export default function TargetScreen() {
  const { db, snapshot, refresh } = useUserData();
  const { colors, typography, spacing } = useTheme();
  const profile = snapshot?.profile;
  const goalKind = snapshot?.goal?.goalKind ?? 'maintain';
  const starter = computeStarterTarget({
    goalKind,
    sex: profile?.sex ?? null,
    weightKg: profile?.weightKg ?? null,
  });
  const coachingOn = profile
    ? isCoachingShellEntryEnabled({
        isAdultConfirmed: profile.isAdultConfirmed,
        exclusions: profile.exclusions,
      })
    : false;

  return (
    <OnboardingShell
      title="Starter target"
      subtitle="Transparent estimate for personal tracking — not medical advice. You can edit targets later."
      primaryLabel="Finish onboarding"
      onPrimary={() => {
        if (!db) return;
        completeOnboardingWithStarterTarget(db);
        refresh();
        router.replace('/today');
      }}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    >
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.metric, { color: colors.ink }]}>
          {starter.energyKcal} kcal
        </Text>
        <Text style={[typography.body, { color: colors.ink }]}>
          P {starter.proteinG}g · C {starter.carbohydrateG}g · F {starter.fatG}g
        </Text>
        <Text style={[typography.caption, { color: colors.muted }]}>
          Coaching shell:{' '}
          {coachingOn ? 'eligible (still stub in M1)' : 'disabled by exclusion/adult gate'}
        </Text>
      </View>
    </OnboardingShell>
  );
}
