import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { ChoiceRow } from './ChoiceRow';
import { useUserData } from '@/components/UserDataProvider';
import {
  COACHING_EXCLUSION_KEYS,
  saveExclusionsStep,
  type CoachingExclusionKey,
} from '@/modules/app-core/user-data';
import { useTheme } from '@/design-system';

const LABELS: Record<CoachingExclusionKey, string> = {
  pregnancy: 'Pregnancy',
  lactation: 'Lactation / breastfeeding',
  eating_disorder_history: 'Eating-disorder history',
  under_clinical_care: 'Under clinical nutrition care',
  clinician_advised_against: 'Clinician advised against adaptive targets',
};

export default function ExclusionsScreen() {
  const { db, snapshot, refresh } = useUserData();
  const { colors, typography, spacing } = useTheme();
  const [selected, setSelected] = useState<CoachingExclusionKey[]>(
    snapshot?.profile.exclusions ?? [],
  );

  const toggle = (key: CoachingExclusionKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  return (
    <OnboardingShell
      title="Safety exclusions"
      subtitle="If any apply, the coaching shell stays disabled (stub OK in M1). Diary and manual targets remain available."
      primaryLabel="Continue"
      onPrimary={() => {
        if (!db) return;
        saveExclusionsStep(db, selected);
        refresh();
        router.push('/onboarding/target');
      }}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    >
      <View>
        <Text style={[typography.body, { color: colors.muted, marginBottom: spacing.sm }]}>
          Select all that apply (optional).
        </Text>
        {COACHING_EXCLUSION_KEYS.map((key) => (
          <ChoiceRow
            key={key}
            label={LABELS[key]}
            selected={selected.includes(key)}
            onPress={() => toggle(key)}
            mode="checkbox"
          />
        ))}
        <ChoiceRow
          label="None of these apply"
          selected={selected.length === 0}
          onPress={() => setSelected([])}
          mode="checkbox"
        />
      </View>
    </OnboardingShell>
  );
}
