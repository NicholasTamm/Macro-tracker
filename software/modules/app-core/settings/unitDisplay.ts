import {
  cmToIn,
  inToCm,
  kgToLb,
  lbToKg,
  round1,
  type EnergyUnit,
  type HeightUnit,
  type MassUnit,
  type ProfilePatch,
} from '../user-data';

export type UnitPreferences = {
  massUnit: MassUnit;
  heightUnit: HeightUnit;
  energyUnit: EnergyUnit;
};

/** A display-only unit update: no canonical measurement fields are included. */
export function unitPreferencePatch(units: UnitPreferences): ProfilePatch {
  return { ...units };
}

export function formatMass(kg: number | null, unit: MassUnit): string {
  if (kg == null) return '';
  return String(round1(unit === 'lb' ? kgToLb(kg) : kg));
}

export function formatHeight(cm: number | null, unit: HeightUnit): string {
  if (cm == null) return '';
  return String(round1(unit === 'in' ? cmToIn(cm) : cm));
}

export function parsePositiveDisplayNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function displayMassToKg(value: string, unit: MassUnit): number | null {
  const parsed = parsePositiveDisplayNumber(value);
  return parsed == null ? null : round1(unit === 'lb' ? lbToKg(parsed) : parsed);
}

export function displayHeightToCm(value: string, unit: HeightUnit): number | null {
  const parsed = parsePositiveDisplayNumber(value);
  return parsed == null ? null : round1(unit === 'in' ? inToCm(parsed) : parsed);
}

export function kcalToKj(kcal: number): number {
  return kcal * 4.184;
}

export function formatEnergy(kcal: number, unit: EnergyUnit): string {
  return String(Math.round(unit === 'kJ' ? kcalToKj(kcal) : kcal));
}
