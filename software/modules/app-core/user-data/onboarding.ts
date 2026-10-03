import type { SqlExecutor } from './sqlExecutor';
import { coachingShellEnabled, type CoachingExclusionKey } from './exclusions';
import { setActiveGoal, saveStarterTarget, getActiveGoal, getLatestTarget } from './goalRepo';
import {
  ensureProfile,
  getProfile,
  isOnboardingComplete,
  updateProfile,
} from './profileRepo';
import {
  LOCAL_PROFILE_ID,
  type EnergyUnit,
  type GoalKind,
  type HeightUnit,
  type MassUnit,
  type OnboardingStep,
  type Sex,
  type UserProfile,
  type UserGoal,
  type DailyTarget,
} from './profileTypes';
import { computeStarterTarget } from './starterTarget';
import { nowIso } from './ids';

export type OnboardingSnapshot = {
  profile: UserProfile;
  goal: UserGoal | null;
  target: DailyTarget | null;
  coachingShellEnabled: boolean;
  complete: boolean;
};

export function loadOnboardingSnapshot(
  db: SqlExecutor,
  profileId: string = LOCAL_PROFILE_ID,
): OnboardingSnapshot {
  const profile = ensureProfile(db, profileId);
  const goal = getActiveGoal(db, profileId);
  const target = getLatestTarget(db, profileId);
  return {
    profile,
    goal,
    target,
    coachingShellEnabled: coachingShellEnabled({
      isAdultConfirmed: profile.isAdultConfirmed,
      exclusions: profile.exclusions,
    }),
    complete: isOnboardingComplete(db, profileId),
  };
}

export function saveAdultGate(db: SqlExecutor, confirmed: boolean): UserProfile {
  const ts = nowIso();
  return updateProfile(db, {
    isAdultConfirmed: confirmed,
    adultConfirmedAt: confirmed ? ts : null,
    onboardingStep: confirmed ? 'units' : 'adult',
  });
}

export function saveUnits(
  db: SqlExecutor,
  units: { massUnit: MassUnit; heightUnit: HeightUnit; energyUnit: EnergyUnit },
): UserProfile {
  return updateProfile(db, { ...units, onboardingStep: 'biometrics' });
}

export function saveBiometrics(
  db: SqlExecutor,
  bio: {
    sex: Sex;
    birthYear: number;
    heightCm: number;
    weightKg: number;
  },
): UserProfile {
  return updateProfile(db, { ...bio, onboardingStep: 'goal' });
}

export function saveGoalStep(
  db: SqlExecutor,
  input: { goalKind: GoalKind; rateKgPerWeek?: number | null },
): { profile: UserProfile; goal: UserGoal } {
  const goal = setActiveGoal(db, input);
  const profile = updateProfile(db, { onboardingStep: 'exclusions' });
  return { profile, goal };
}

export function saveExclusionsStep(
  db: SqlExecutor,
  exclusions: CoachingExclusionKey[],
): UserProfile {
  return updateProfile(db, { exclusions, onboardingStep: 'target' });
}

export function completeOnboardingWithStarterTarget(
  db: SqlExecutor,
  override?: { energyKcal?: number },
): OnboardingSnapshot {
  const profile = ensureProfile(db);
  const goal = getActiveGoal(db);
  const goalKind: GoalKind = goal?.goalKind ?? 'maintain';
  let starter = computeStarterTarget({
    goalKind,
    sex: profile.sex,
    weightKg: profile.weightKg,
  });
  if (override?.energyKcal != null) {
    const energy = override.energyKcal;
    starter = {
      energyKcal: energy,
      proteinG: Math.round((energy * 0.3) / 4),
      carbohydrateG: Math.round((energy * 0.4) / 4),
      fatG: Math.round((energy * 0.3) / 9),
    };
  }
  saveStarterTarget(db, starter);
  updateProfile(db, {
    onboardingStep: 'done',
    onboardingCompletedAt: nowIso(),
  });
  return loadOnboardingSnapshot(db);
}

export function setOnboardingStep(db: SqlExecutor, step: OnboardingStep): UserProfile {
  return updateProfile(db, { onboardingStep: step });
}

export function nextStepAfter(step: OnboardingStep): OnboardingStep | null {
  const order: OnboardingStep[] = [
    'adult',
    'units',
    'biometrics',
    'goal',
    'exclusions',
    'target',
    'done',
  ];
  const i = order.indexOf(step);
  if (i < 0 || i >= order.length - 1) return null;
  return order[i + 1]!;
}

export { isOnboardingComplete, getProfile, LOCAL_PROFILE_ID };
