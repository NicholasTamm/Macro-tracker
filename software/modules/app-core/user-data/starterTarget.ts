import type { GoalKind } from './profileTypes';

export type StarterTarget = {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
};

/**
 * Transparent non-clinical starter estimate for M1 onboarding.
 * Labeled in UI as an estimate, not medical advice.
 */
export function computeStarterTarget(input: {
  goalKind: GoalKind;
  sex: 'female' | 'male' | 'other' | 'unspecified' | null;
  weightKg: number | null;
}): StarterTarget {
  const sex = input.sex ?? 'unspecified';
  let base =
    sex === 'female' ? 1800 : sex === 'male' ? 2200 : 2000;
  if (input.weightKg != null && input.weightKg > 0) {
    // Light anchor: ~30 kcal/kg clamped into a conservative band.
    const anchored = Math.round(input.weightKg * 30);
    base = Math.min(3200, Math.max(1400, Math.round((base + anchored) / 2)));
  }
  let energy = base;
  if (input.goalKind === 'lose') energy = Math.max(1400, base - 500);
  else if (input.goalKind === 'gain') energy = base + 300;

  const proteinG = Math.round((energy * 0.3) / 4);
  const carbohydrateG = Math.round((energy * 0.4) / 4);
  const fatG = Math.round((energy * 0.3) / 9);
  return { energyKcal: energy, proteinG, carbohydrateG, fatG };
}
