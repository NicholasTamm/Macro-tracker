import { useState } from 'react';
import { router } from 'expo-router';
import { TextInput, View, Text } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { ChoiceRow } from './ChoiceRow';
import { useUserData } from '@/components/UserDataProvider';
import { saveBiometrics, type Sex } from '@/modules/app-core/user-data';
import { useTheme } from '@/design-system';

export default function BiometricsScreen() {
  const { db, snapshot, refresh } = useUserData();
  const { colors, spacing, typography, radius } = useTheme();
  const p = snapshot?.profile;
  const [sex, setSex] = useState<Sex>(p?.sex ?? 'unspecified');
  const [birthYear, setBirthYear] = useState(String(p?.birthYear ?? 1995));
  const [heightCm, setHeightCm] = useState(String(p?.heightCm ?? 170));
  const [weightKg, setWeightKg] = useState(String(p?.weightKg ?? 70));

  const year = Number(birthYear);
  const height = Number(heightCm);
  const weight = Number(weightKg);
  const valid =
    Number.isFinite(year) &&
    year >= 1900 &&
    year <= new Date().getFullYear() - 18 &&
    Number.isFinite(height) &&
    height > 0 &&
    Number.isFinite(weight) &&
    weight > 0;

  const field = (label: string, value: string, onChange: (v: string) => void, a11y: string) => (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.muted, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        accessibilityLabel={a11y}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
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
  );

  return (
    <OnboardingShell
      title="Biometrics"
      subtitle="Stored only on this device. Used for a transparent starter calorie estimate."
      primaryLabel="Continue"
      primaryDisabled={!valid}
      onPrimary={() => {
        if (!db || !valid) return;
        saveBiometrics(db, { sex, birthYear: year, heightCm: height, weightKg: weight });
        refresh();
        router.push('/onboarding/goal');
      }}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    >
      <View>
        <ChoiceRow label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
        <ChoiceRow label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
        <ChoiceRow label="Other" selected={sex === 'other'} onPress={() => setSex('other')} />
        <ChoiceRow
          label="Prefer not to say"
          selected={sex === 'unspecified'}
          onPress={() => setSex('unspecified')}
        />
        {field('Birth year', birthYear, setBirthYear, 'Birth year')}
        {field('Height (cm)', heightCm, setHeightCm, 'Height in centimetres')}
        {field('Weight (kg)', weightKg, setWeightKg, 'Weight in kilograms')}
      </View>
    </OnboardingShell>
  );
}
