import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, useTheme } from '@/design-system';
import { useUserData } from '@/components/UserDataProvider';
import { updateProfile, type Sex } from '@/modules/app-core/user-data';
import {
  displayHeightToCm,
  displayMassToKg,
  formatHeight,
  formatMass,
  isAdultBirthYear,
  profileEditPatch,
} from '@/modules/app-core/settings';
import { ChoiceRow } from '@/app/onboarding/ChoiceRow';
import { SettingsShell } from './SettingsShell';

export default function ProfileScreen() {
  const { ready, db, snapshot, refresh } = useUserData();
  const { colors, spacing, radius, typography } = useTheme();
  const profile = snapshot?.profile;
  const massUnit = profile?.massUnit ?? 'kg';
  const heightUnit = profile?.heightUnit ?? 'cm';
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'unspecified');
  const [birthYear, setBirthYear] = useState(profile?.birthYear == null ? '' : String(profile.birthYear));
  const [height, setHeight] = useState(formatHeight(profile?.heightCm ?? null, heightUnit));
  const [weight, setWeight] = useState(formatMass(profile?.weightKg ?? null, massUnit));
  const [heightEdited, setHeightEdited] = useState(false);
  const [weightEdited, setWeightEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!ready || !profile || hydrated.current) return;
    setSex(profile.sex ?? 'unspecified');
    setBirthYear(profile.birthYear == null ? '' : String(profile.birthYear));
    setHeight(formatHeight(profile.heightCm, profile.heightUnit));
    setWeight(formatMass(profile.weightKg, profile.massUnit));
    hydrated.current = true;
  }, [ready, profile]);

  const parsed = useMemo(() => {
    const year = Number(birthYear);
    return {
      year,
      heightCm: displayHeightToCm(height, heightUnit),
      weightKg: displayMassToKg(weight, massUnit),
      validYear: isAdultBirthYear(year),
    };
  }, [birthYear, height, heightUnit, weight, massUnit]);
  const valid = parsed.validYear && parsed.heightCm != null && parsed.weightKg != null;

  const field = (label: string, unit: string | null, value: string, onChangeText: (value: string) => void) => (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.caption, { color: colors.muted }]}>{unit ? `${label} (${unit})` : label}</Text>
      <TextInput
        accessibilityLabel={unit ? `${label} in ${unit}` : label}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={{
          minHeight: 44,
          color: colors.ink,
          backgroundColor: colors.raised,
          borderColor: colors.divider,
          borderWidth: 1,
          borderRadius: radius.card,
          paddingHorizontal: spacing.md,
        }}
      />
    </View>
  );

  return (
    <SettingsShell title="Profile" intro="Your measurements are stored on this device in canonical centimetres and kilograms.">
      <Card style={{ gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>Sex</Text>
        <ChoiceRow label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
        <ChoiceRow label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
        <ChoiceRow label="Other" selected={sex === 'other'} onPress={() => setSex('other')} />
        <ChoiceRow label="Prefer not to say" selected={sex === 'unspecified'} onPress={() => setSex('unspecified')} />
        {field('Birth year', null, birthYear, setBirthYear)}
        {field('Height', heightUnit, height, (value) => {
          setHeight(value);
          setHeightEdited(true);
        })}
        {field('Weight', massUnit, weight, (value) => {
          setWeight(value);
          setWeightEdited(true);
        })}
      </Card>
      {!valid ? <Text style={[typography.caption, { color: colors.danger }]}>Enter an adult birth year and positive height and weight.</Text> : null}
      <PrimaryButton
        label="Save profile"
        disabled={!db || !valid}
        onPress={() => {
          if (!db || !valid || parsed.heightCm == null || parsed.weightKg == null) return;
          updateProfile(db, profileEditPatch({
            sex,
            birthYear: parsed.year,
            heightCm: parsed.heightCm,
            weightKg: parsed.weightKg,
            heightEdited,
            weightEdited,
          }));
          refresh();
          setHeightEdited(false);
          setWeightEdited(false);
          setMessage('Profile saved.');
        }}
      />
      {message ? <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.muted }]}>{message}</Text> : null}
    </SettingsShell>
  );
}
