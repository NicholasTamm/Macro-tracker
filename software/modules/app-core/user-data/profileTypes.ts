import type { CoachingExclusionKey } from './exclusions';

export type MassUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'in';
export type EnergyUnit = 'kcal' | 'kJ';
export type Sex = 'female' | 'male' | 'other' | 'unspecified';
export type GoalKind = 'lose' | 'gain' | 'maintain';

export type OnboardingStep =
  | 'adult'
  | 'units'
  | 'biometrics'
  | 'goal'
  | 'exclusions'
  | 'target'
  | 'done';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'adult',
  'units',
  'biometrics',
  'goal',
  'exclusions',
  'target',
  'done',
];

export const LOCAL_PROFILE_ID = 'local-profile';

export type UserProfile = {
  id: string;
  isAdultConfirmed: boolean;
  adultConfirmedAt: string | null;
  massUnit: MassUnit;
  heightUnit: HeightUnit;
  energyUnit: EnergyUnit;
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  exclusions: CoachingExclusionKey[];
  onboardingStep: OnboardingStep;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncRevision: number;
};

export type UserGoal = {
  id: string;
  profileId: string;
  goalKind: GoalKind;
  rateKgPerWeek: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  syncRevision: number;
};

export type DailyTarget = {
  id: string;
  profileId: string;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  source: 'starter' | 'manual' | 'coaching';
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
  syncRevision: number;
};
