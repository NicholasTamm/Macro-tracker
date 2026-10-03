import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { OnboardingShell } from './OnboardingShell';
import { ChoiceRow } from './ChoiceRow';
import { useUserData } from '@/components/UserDataProvider';
import {
  saveUnits,
  type EnergyUnit,
  type HeightUnit,
  type MassUnit,
} from '@/modules/app-core/user-data';

export default function UnitsScreen() {
  const { db, snapshot, refresh } = useUserData();
  const [massUnit, setMassUnit] = useState<MassUnit>(snapshot?.profile.massUnit ?? 'kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(
    snapshot?.profile.heightUnit ?? 'cm',
  );
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>(
    snapshot?.profile.energyUnit ?? 'kcal',
  );

  return (
    <OnboardingShell
      title="Choose your units"
      subtitle="You can change these later in Settings."
      primaryLabel="Continue"
      onPrimary={() => {
        if (!db) return;
        saveUnits(db, { massUnit, heightUnit, energyUnit });
        refresh();
        router.push('/onboarding/biometrics');
      }}
      secondaryLabel="Back"
      onSecondary={() => router.back()}
    >
      <View>
        <ChoiceRow label="Kilograms (kg)" selected={massUnit === 'kg'} onPress={() => setMassUnit('kg')} />
        <ChoiceRow label="Pounds (lb)" selected={massUnit === 'lb'} onPress={() => setMassUnit('lb')} />
        <ChoiceRow label="Centimetres (cm)" selected={heightUnit === 'cm'} onPress={() => setHeightUnit('cm')} />
        <ChoiceRow label="Inches (in)" selected={heightUnit === 'in'} onPress={() => setHeightUnit('in')} />
        <ChoiceRow label="Kilocalories (kcal)" selected={energyUnit === 'kcal'} onPress={() => setEnergyUnit('kcal')} />
        <ChoiceRow label="Kilojoules (kJ)" selected={energyUnit === 'kJ'} onPress={() => setEnergyUnit('kJ')} />
      </View>
    </OnboardingShell>
  );
}
