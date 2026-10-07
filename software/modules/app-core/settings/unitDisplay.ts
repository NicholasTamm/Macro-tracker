import {
  cmToIn,
  inToCm,
  kgToLb,
  lbToKg,
  round1,
} from '../user-data/unitConvert';
import type {
  EnergyUnit,
  HeightUnit,
  MassUnit,
  Sex,
} from '../user-data/profileTypes';
import type { ProfilePatch } from '../user-data/profileRepo';

export type UnitPreferences = {
  massUnit: MassUnit;
  heightUnit: HeightUnit;
  energyUnit: EnergyUnit;
};

/** A display-only unit update: no canonical measurement fields are included. */
export function unitPreferencePatch(units: UnitPreferences): ProfilePatch {
  return { ...units };
}

export function isAdultBirthYear(year: number, currentYear = new Date().getFullYear()): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= currentYear - 18;
}

export function profileEditPatch(input: {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  heightEdited: boolean;
  weightEdited: boolean;
}): ProfilePatch {
  return {
    sex: input.sex,
    birthYear: input.birthYear,
    ...(input.heightEdited ? { heightCm: input.heightCm } : {}),
    ...(input.weightEdited ? { weightKg: input.weightKg } : {}),
  };
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

export function formatEnergyInput(kcal: number | null, unit: EnergyUnit): string {
  if (kcal == null) return '';
  return String(unit === 'kJ' ? Number(kcalToKj(kcal).toFixed(6)) : kcal);
}

export function energyInputToKcalText(value: string, unit: EnergyUnit): string {
  if (unit === 'kcal' || value.trim() === '') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? String(Number((parsed / 4.184).toFixed(6)))
    : value;
}

export function energyUnitForSpeech(unit: EnergyUnit): string {
  return unit === 'kJ' ? 'kilojoules' : 'kilocalories';
}

export function formatEnergy(kcal: number, unit: EnergyUnit): string {
  return String(Math.round(unit === 'kJ' ? kcalToKj(kcal) : kcal));
}
