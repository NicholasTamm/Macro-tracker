import { useState } from 'react';
import { router } from 'expo-router';
import { View, TextInput, Text } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { ChoiceRow } from './ChoiceRow';
import { useUserData } from '@/components/UserDataProvider';
import { saveGoalStep, type GoalKind } from '@/modules/app-core/user-data';
import { useTheme } from '@/design-system';

export default function GoalScreen() {
  const { db, snapshot, refresh } = useUserData();
  const { colors, spacing, typography, radius } = useTheme();
  const [goalKind, setGoalKind] = useState<GoalKind>(
    snapshot?.goal?.goalKind ?? 'maintain',
  );
  const [rate, setRate] = useState(
    String(snapshot?.goal?.rateKgPerWeek ?? (goalKind === 'lose' ? 0.5 : 0.25)),
  );

  return (
    <OnboardingShell
      title="Goal and rate"
      subtitle="Pick a direction. Rate is kg per week (informational for M1 starter targets)."
      primaryLabel="Continue"
      onPrimary={() => {
        if (!db) return;
        const rateKgPerWeek =
          goalKind === 'maintain' ? null : Math.max(0, Number(rate) || 0);
        saveGoalStep(db, { goalKind, rateKgPerWeek });
        refresh();
        router.push('/onboarding/exclusions');
      }}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    >
      <View>
        <ChoiceRow
          label="Lose weight"
          selected={goalKind === 'lose'}
          onPress={() => setGoalKind('lose')}
        />
        <ChoiceRow
          label="Maintain"
          selected={goalKind === 'maintain'}
          onPress={() => setGoalKind('maintain')}
        />
        <ChoiceRow
          label="Gain weight"
          selected={goalKind === 'gain'}
          onPress={() => setGoalKind('gain')}
        />
        {goalKind !== 'maintain' ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.muted, marginBottom: 4 }]}>
              Rate (kg / week)
            </Text>
            <TextInput
              accessibilityLabel="Rate in kilograms per week"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              style={{
                minHeight: 44,
                borderWidth: 1,
                borderColor: colors.divider,
                borderRadius: radius.card,
                paddingHorizontal: spacing.md,
                color: colors.ink,
                backgroundColor: colors.raised,
              }}
            />
          </View>
        ) : null}
      </View>
    </OnboardingShell>
  );
}
