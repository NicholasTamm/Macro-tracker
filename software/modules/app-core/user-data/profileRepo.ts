import type { SqlExecutor } from './sqlExecutor';
import { nowIso } from './ids';
import {
  parseExclusionsJson,
  serializeExclusions,
  type CoachingExclusionKey,
} from './exclusions';
import {
  LOCAL_PROFILE_ID,
  type EnergyUnit,
  type HeightUnit,
  type MassUnit,
  type OnboardingStep,
  type Sex,
  type UserProfile,
} from './profileTypes';

function mapRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    isAdultConfirmed: Number(row.is_adult_confirmed) === 1,
    adultConfirmedAt: row.adult_confirmed_at == null ? null : String(row.adult_confirmed_at),
    massUnit: row.mass_unit as MassUnit,
    heightUnit: row.height_unit as HeightUnit,
    energyUnit: row.energy_unit as EnergyUnit,
    sex: row.sex == null ? null : (row.sex as Sex),
    birthYear: row.birth_year == null ? null : Number(row.birth_year),
    heightCm: row.height_cm == null ? null : Number(row.height_cm),
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    exclusions: parseExclusionsJson(String(row.exclusions_json ?? '[]')),
    onboardingStep: String(row.onboarding_step) as OnboardingStep,
    onboardingCompletedAt:
      row.onboarding_completed_at == null ? null : String(row.onboarding_completed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    syncRevision: Number(row.sync_revision),
  };
}

export function getProfile(db: SqlExecutor, id: string = LOCAL_PROFILE_ID): UserProfile | null {
  const row = db.get(`SELECT * FROM user_profile WHERE id = ?`, [id]);
  return row ? mapRow(row) : null;
}

export function ensureProfile(db: SqlExecutor, id: string = LOCAL_PROFILE_ID): UserProfile {
  const existing = getProfile(db, id);
  if (existing) return existing;
  const ts = nowIso();
  db.run(
    `INSERT INTO user_profile (
      id, is_adult_confirmed, adult_confirmed_at, mass_unit, height_unit, energy_unit,
      sex, birth_year, height_cm, weight_kg, exclusions_json, onboarding_step,
      onboarding_completed_at, created_at, updated_at, sync_revision
    ) VALUES (?, 0, NULL, 'kg', 'cm', 'kcal', NULL, NULL, NULL, NULL, '[]', 'adult', NULL, ?, ?, 0)`,
    [id, ts, ts],
  );
  const row = getProfile(db, id);
  if (!row) throw new Error('ensureProfile insert failed');
  return row;
}

export type ProfilePatch = {
  isAdultConfirmed?: boolean;
  adultConfirmedAt?: string | null;
  massUnit?: MassUnit;
  heightUnit?: HeightUnit;
  energyUnit?: EnergyUnit;
  sex?: Sex | null;
  birthYear?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  exclusions?: CoachingExclusionKey[];
  onboardingStep?: OnboardingStep;
  onboardingCompletedAt?: string | null;
};

export function updateProfile(
  db: SqlExecutor,
  patch: ProfilePatch,
  id: string = LOCAL_PROFILE_ID,
): UserProfile {
  ensureProfile(db, id);
  const cur = getProfile(db, id)!;
  const next = {
    isAdultConfirmed: patch.isAdultConfirmed ?? cur.isAdultConfirmed,
    adultConfirmedAt:
      patch.adultConfirmedAt !== undefined ? patch.adultConfirmedAt : cur.adultConfirmedAt,
    massUnit: patch.massUnit ?? cur.massUnit,
    heightUnit: patch.heightUnit ?? cur.heightUnit,
    energyUnit: patch.energyUnit ?? cur.energyUnit,
    sex: patch.sex !== undefined ? patch.sex : cur.sex,
    birthYear: patch.birthYear !== undefined ? patch.birthYear : cur.birthYear,
    heightCm: patch.heightCm !== undefined ? patch.heightCm : cur.heightCm,
    weightKg: patch.weightKg !== undefined ? patch.weightKg : cur.weightKg,
    exclusions: patch.exclusions ?? cur.exclusions,
    onboardingStep: patch.onboardingStep ?? cur.onboardingStep,
    onboardingCompletedAt:
      patch.onboardingCompletedAt !== undefined
        ? patch.onboardingCompletedAt
        : cur.onboardingCompletedAt,
  };
  const ts = nowIso();
  db.run(
    `UPDATE user_profile SET
      is_adult_confirmed = ?, adult_confirmed_at = ?, mass_unit = ?, height_unit = ?, energy_unit = ?,
      sex = ?, birth_year = ?, height_cm = ?, weight_kg = ?, exclusions_json = ?,
      onboarding_step = ?, onboarding_completed_at = ?, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ?`,
    [
      next.isAdultConfirmed ? 1 : 0,
      next.adultConfirmedAt,
      next.massUnit,
      next.heightUnit,
      next.energyUnit,
      next.sex,
      next.birthYear,
      next.heightCm,
      next.weightKg,
      serializeExclusions(next.exclusions),
      next.onboardingStep,
      next.onboardingCompletedAt,
      ts,
      id,
    ],
  );
  const row = getProfile(db, id);
  if (!row) throw new Error('updateProfile failed');
  return row;
}

export function isOnboardingComplete(db: SqlExecutor, id: string = LOCAL_PROFILE_ID): boolean {
  const p = getProfile(db, id);
  return !!(p && p.onboardingCompletedAt && p.onboardingStep === 'done' && p.isAdultConfirmed);
}
