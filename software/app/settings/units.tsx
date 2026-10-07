import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Card, PrimaryButton, useTheme } from '@/design-system';
import { ChoiceRow } from '@/app/onboarding/ChoiceRow';
import { useUserData } from '@/components/UserDataProvider';
import { updateProfile, type EnergyUnit, type HeightUnit, type MassUnit } from '@/modules/app-core/user-data';
import { unitPreferencePatch, type ThemePreference } from '@/modules/app-core/settings';
import { SettingsShell } from './SettingsShell';

export default function UnitsScreen() {
  const { ready, db, snapshot, refresh, themePreference, setThemePreference } = useUserData();
  const { colors, spacing, typography } = useTheme();
  const profile = snapshot?.profile;
  const [massUnit, setMassUnit] = useState<MassUnit>(profile?.massUnit ?? 'kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(profile?.heightUnit ?? 'cm');
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>(profile?.energyUnit ?? 'kcal');
  const [theme, setTheme] = useState<ThemePreference>(themePreference);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!ready || !profile || hydrated.current) return;
    setMassUnit(profile.massUnit);
    setHeightUnit(profile.heightUnit);
    setEnergyUnit(profile.energyUnit);
    setTheme(themePreference);
    hydrated.current = true;
  }, [ready, profile, themePreference]);

  return (
    <SettingsShell title="Units & appearance" intro="Units change how values are displayed. Stored measurements and calorie targets are not converted or rewritten.">
      <Card style={{ gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>Mass</Text>
        <ChoiceRow label="Kilograms (kg)" selected={massUnit === 'kg'} onPress={() => setMassUnit('kg')} />
        <ChoiceRow label="Pounds (lb)" selected={massUnit === 'lb'} onPress={() => setMassUnit('lb')} />
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>Height</Text>
        <ChoiceRow label="Centimetres (cm)" selected={heightUnit === 'cm'} onPress={() => setHeightUnit('cm')} />
        <ChoiceRow label="Inches (in)" selected={heightUnit === 'in'} onPress={() => setHeightUnit('in')} />
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>Energy</Text>
        <ChoiceRow label="Kilocalories (kcal)" selected={energyUnit === 'kcal'} onPress={() => setEnergyUnit('kcal')} />
        <ChoiceRow label="Kilojoules (kJ)" selected={energyUnit === 'kJ'} onPress={() => setEnergyUnit('kJ')} />
      </Card>
      <Card style={{ gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>Theme</Text>
        <ChoiceRow label="Use system theme" selected={theme === 'system'} onPress={() => setTheme('system')} />
        <ChoiceRow label="Light theme" selected={theme === 'light'} onPress={() => setTheme('light')} />
        <ChoiceRow label="Dark theme" selected={theme === 'dark'} onPress={() => setTheme('dark')} />
      </Card>
      <PrimaryButton
        label="Save units and appearance"
        disabled={!db}
        onPress={() => {
          if (!db) return;
          updateProfile(db, unitPreferencePatch({ massUnit, heightUnit, energyUnit }));
          setThemePreference(theme);
          refresh();
          setSaved(true);
        }}
      />
      {saved ? <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.muted }]}>Settings saved.</Text> : null}
    </SettingsShell>
  );
}
