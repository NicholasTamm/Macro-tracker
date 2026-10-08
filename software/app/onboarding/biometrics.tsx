import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { TextInput, View, Text } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { ChoiceGroup, ChoiceRow } from './ChoiceRow';
import { useUserData } from '@/components/UserDataProvider';
import {
  cmToIn,
  inToCm,
  kgToLb,
  lbToKg,
  round1,
  saveBiometrics,
  type Sex,
} from '@/modules/app-core/user-data';
import { useTheme } from '@/design-system';
import { isAdultBirthYear } from '@/modules/app-core/settings';

export default function BiometricsScreen() {
  const { db, snapshot, refresh } = useUserData();
  const { colors, spacing, typography, radius } = useTheme();
  const p = snapshot?.profile;
  const massUnit = p?.massUnit ?? 'kg';
  const heightUnit = p?.heightUnit ?? 'cm';

  const [sex, setSex] = useState<Sex>(p?.sex ?? 'unspecified');
  const [birthYear, setBirthYear] = useState(String(p?.birthYear ?? 1995));

  const initialHeightDisplay = useMemo(() => {
    const cm = p?.heightCm ?? 170;
    return String(heightUnit === 'in' ? round1(cmToIn(cm)) : cm);
  }, [p?.heightCm, heightUnit]);
  const initialWeightDisplay = useMemo(() => {
    const kg = p?.weightKg ?? 70;
    return String(massUnit === 'lb' ? round1(kgToLb(kg)) : kg);
  }, [p?.weightKg, massUnit]);

  const [heightDisplay, setHeightDisplay] = useState(initialHeightDisplay);
  const [weightDisplay, setWeightDisplay] = useState(initialWeightDisplay);

  const year = Number(birthYear);
  const heightNum = Number(heightDisplay);
  const weightNum = Number(weightDisplay);
  const heightCm = heightUnit === 'in' ? inToCm(heightNum) : heightNum;
  const weightKg = massUnit === 'lb' ? lbToKg(weightNum) : weightNum;

  const valid =
    isAdultBirthYear(year) &&
    Number.isFinite(heightCm) &&
    heightCm > 0 &&
    Number.isFinite(weightKg) &&
    weightKg > 0;

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
          borderColor: colors.controlBorder,
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
      subtitle="Stored only on this device (canonical cm/kg). Used for a transparent starter calorie estimate."
      primaryLabel="Continue"
      primaryDisabled={!valid}
      onPrimary={() => {
        if (!db || !valid) return;
        saveBiometrics(db, {
          sex,
          birthYear: year,
          heightCm: round1(heightCm),
          weightKg: round1(weightKg),
        });
        refresh();
        router.push('/onboarding/goal');
      }}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    >
      <View>
        <ChoiceGroup label="Sex">
          <ChoiceRow label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
          <ChoiceRow label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
          <ChoiceRow label="Other" selected={sex === 'other'} onPress={() => setSex('other')} />
          <ChoiceRow
            label="Prefer not to say"
            selected={sex === 'unspecified'}
            onPress={() => setSex('unspecified')}
          />
        </ChoiceGroup>
        {field('Birth year', birthYear, setBirthYear, 'Birth year')}
        {field(
          `Height (${heightUnit})`,
          heightDisplay,
          setHeightDisplay,
          `Height in ${heightUnit}`,
        )}
        {field(
          `Weight (${massUnit})`,
          weightDisplay,
          setWeightDisplay,
          `Weight in ${massUnit}`,
        )}
      </View>
    </OnboardingShell>
  );
}
