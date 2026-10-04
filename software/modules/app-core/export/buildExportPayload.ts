/**
 * Build offline user-data export payload (M1-19).
 * Includes profile, diary snapshots, weights, targets, provenance.
 * Does not dump shared FoodSeed / remote provider caches.
 */
import {
  USER_STORE_SCHEMA_VERSION,
  getActiveGoal,
  getLatestTarget,
  getProfile,
  listCustomFoods,
  listWeightSamples,
  type SqlExecutor,
} from '../user-data';
import type {
  ExportCustomFood,
  ExportDiaryEntry,
  ExportGoal,
  ExportTarget,
  UserDataExport,
} from './types';

function listAllDiaryEntries(db: SqlExecutor): ExportDiaryEntry[] {
  const rows = db.all(
    `SELECT * FROM diary_entry ORDER BY timestamp ASC, id ASC`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    timestamp: String(row.timestamp),
    localDayKey: String(row.local_day_key),
    timezoneIdentifier: String(row.timezone_identifier),
    mealSlotId: row.meal_slot_id == null ? null : String(row.meal_slot_id),
    foodKind: String(row.food_kind),
    foodStableId: String(row.food_stable_id),
    foodDisplayName: String(row.food_display_name),
    foodLicenseTag: String(row.food_license_tag),
    quantity: Number(row.quantity),
    unitLabel: String(row.unit_label),
    grams: row.grams == null ? null : Number(row.grams),
    nutritionSnapshot: JSON.parse(String(row.nutrition_snapshot_json)) as Record<
      string,
      number | null
    >,
    sourceDisplayName: String(row.source_display_name),
    licenseTag: String(row.license_tag),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
  }));
}

function listAllTargets(db: SqlExecutor): ExportTarget[] {
  const rows = db.all(
    `SELECT * FROM daily_target ORDER BY effective_from ASC, updated_at ASC`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    profileId: String(row.profile_id),
    energyKcal: Number(row.energy_kcal),
    proteinG: Number(row.protein_g),
    carbohydrateG: Number(row.carbohydrate_g),
    fatG: Number(row.fat_g),
    source: String(row.source),
    effectiveFrom: String(row.effective_from),
  }));
}

function listAllGoals(db: SqlExecutor): ExportGoal[] {
  const rows = db.all(`SELECT * FROM user_goal ORDER BY created_at ASC`);
  return rows.map((row) => ({
    id: String(row.id),
    profileId: String(row.profile_id),
    goalKind: String(row.goal_kind),
    rateKgPerWeek:
      row.rate_kg_per_week == null ? null : Number(row.rate_kg_per_week),
    isActive: Number(row.is_active) === 1,
  }));
}

export function buildExportPayload(
  db: SqlExecutor,
  opts: { exportedAt?: string } = {},
): UserDataExport {
  const exportedAt = opts.exportedAt ?? new Date().toISOString();
  const profile = getProfile(db);
  const customFoods: ExportCustomFood[] = listCustomFoods(db, {
    includeArchived: true,
    limit: 10_000,
  }).map((f) => ({
    id: f.id,
    name: f.name,
    brand: f.brand,
    barcodeGtin14: f.barcodeGtin14,
    basisKind: f.basisKind,
    basisAmount: f.basisAmount,
    basisUnit: f.basisUnit,
    gramWeightForBasis: f.gramWeightForBasis,
    nutrients: f.nutrients,
    isArchived: f.isArchived,
    deletedAt: f.deletedAt,
  }));

  // Touch goal/target helpers so schema presence is exercised; full lists below.
  void getActiveGoal(db);
  void getLatestTarget(db);

  return {
    provenance: {
      exportedAt,
      appId: 'macro-tracker',
      schemaVersion: USER_STORE_SCHEMA_VERSION,
      formatVersion: 1,
      note:
        'User-owned offline export. Includes diary nutrition snapshots and per-entry source/license tags. Does not include shared FoodSeed catalog or remote provider caches.',
    },
    profile: profile
      ? {
          id: profile.id,
          isAdultConfirmed: profile.isAdultConfirmed,
          massUnit: profile.massUnit,
          heightUnit: profile.heightUnit,
          energyUnit: profile.energyUnit,
          sex: profile.sex,
          birthYear: profile.birthYear,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          exclusions: [...profile.exclusions],
          onboardingStep: profile.onboardingStep,
          onboardingCompletedAt: profile.onboardingCompletedAt,
        }
      : null,
    goals: listAllGoals(db),
    targets: listAllTargets(db),
    diaryEntries: listAllDiaryEntries(db),
    weights: listWeightSamples(db, { includeDeleted: false }).map((w) => ({
      id: w.id,
      timestamp: w.timestamp,
      kilograms: w.kilograms,
      source: w.source,
      confirmedOutlier: w.confirmedOutlier,
      deletedAt: w.deletedAt,
    })),
    customFoods,
  };
}
