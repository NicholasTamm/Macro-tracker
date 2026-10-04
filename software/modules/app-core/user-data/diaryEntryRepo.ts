import type { SqlExecutor } from './sqlExecutor';
import { newEntityId, nowIso } from './ids';
import { parseNutrients, serializeNutrients, type NutrientMap } from './nutrients';

export type DiaryEntry = {
  id: string;
  timestamp: string;
  localDayKey: string;
  timezoneIdentifier: string;
  mealSlotId: string | null;
  foodKind: string;
  foodStableId: string;
  foodDisplayName: string;
  foodLicenseTag: string;
  quantity: number;
  unitLabel: string;
  grams: number | null;
  nutritionSnapshot: NutrientMap;
  sourceDisplayName: string;
  licenseTag: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DiaryEntryCreate = {
  timestamp: string;
  localDayKey: string;
  timezoneIdentifier: string;
  mealSlotId?: string | null;
  foodKind: 'seed' | 'custom' | 'off' | 'fdc_branded' | 'fatsecret';
  foodStableId: string;
  foodDisplayName: string;
  foodLicenseTag: string;
  quantity: number;
  unitLabel: string;
  grams?: number | null;
  nutritionSnapshot: NutrientMap;
  sourceDisplayName: string;
  licenseTag: string;
};

function mapRow(row: Record<string, unknown>): DiaryEntry {
  return {
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
    nutritionSnapshot: parseNutrients(String(row.nutrition_snapshot_json)),
    sourceDisplayName: String(row.source_display_name),
    licenseTag: String(row.license_tag),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
  };
}

export function createDiaryEntry(db: SqlExecutor, input: DiaryEntryCreate): DiaryEntry {
  const id = newEntityId();
  const ts = nowIso();
  db.run(
    `INSERT INTO diary_entry (
      id, timestamp, local_day_key, timezone_identifier, meal_slot_id,
      food_kind, food_stable_id, food_provider_id, food_gtin14, food_display_name, food_brand, food_license_tag,
      quantity, unit_label, grams, nutrition_snapshot_json,
      source_display_name, source_url, license_tag, remote_terms_version,
      created_at, updated_at, deleted_at, sync_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, NULL, 0)`,
    [
      id,
      input.timestamp,
      input.localDayKey,
      input.timezoneIdentifier,
      input.mealSlotId ?? null,
      input.foodKind,
      input.foodStableId,
      input.foodDisplayName,
      input.foodLicenseTag,
      input.quantity,
      input.unitLabel,
      input.grams ?? null,
      serializeNutrients(input.nutritionSnapshot),
      input.sourceDisplayName,
      input.licenseTag,
      ts,
      ts,
    ],
  );
  const row = db.get(`SELECT * FROM diary_entry WHERE id = ?`, [id]);
  if (!row) throw new Error('insert diary_entry failed');
  return mapRow(row);
}

export function listDiaryEntriesForDay(db: SqlExecutor, localDayKey: string): DiaryEntry[] {
  return db
    .all(`SELECT * FROM diary_entry WHERE local_day_key = ? AND deleted_at IS NULL ORDER BY timestamp`, [
      localDayKey,
    ])
    .map(mapRow);
}

/** Fetch by id. When `includeDeleted`, soft-deleted rows are returned for undo restore. */
export function getDiaryEntry(
  db: SqlExecutor,
  id: string,
  opts: { includeDeleted?: boolean } = {},
): DiaryEntry | null {
  const row = opts.includeDeleted
    ? db.get(`SELECT * FROM diary_entry WHERE id = ?`, [id])
    : db.get(`SELECT * FROM diary_entry WHERE id = ? AND deleted_at IS NULL`, [id]);
  if (!row) return null;
  return mapRow(row);
}

export function tombstoneDiaryEntry(db: SqlExecutor, id: string): void {
  const ts = nowIso();
  db.run(
    `UPDATE diary_entry SET deleted_at = ?, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [ts, ts, id],
  );
}

/** Clear soft-delete (undo delete). No-op if already live. */
export function restoreDiaryEntry(db: SqlExecutor, id: string): DiaryEntry | null {
  const ts = nowIso();
  db.run(
    `UPDATE diary_entry SET deleted_at = NULL, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NOT NULL`,
    [ts, id],
  );
  return getDiaryEntry(db, id);
}

export type DiaryEntryNutritionPatch = {
  quantity: number;
  grams: number | null;
  nutritionSnapshot: NutrientMap;
};

/**
 * Replace quantity / grams / immutable nutrition snapshot fields.
 * Does not re-read seed or custom food — callers must supply the new snapshot.
 */
export function updateDiaryEntryNutrition(
  db: SqlExecutor,
  id: string,
  patch: DiaryEntryNutritionPatch,
): DiaryEntry {
  const ts = nowIso();
  db.run(
    `UPDATE diary_entry SET
       quantity = ?,
       grams = ?,
       nutrition_snapshot_json = ?,
       updated_at = ?,
       sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [patch.quantity, patch.grams, serializeNutrients(patch.nutritionSnapshot), ts, id],
  );
  const entry = getDiaryEntry(db, id);
  if (!entry) throw new Error(`updateDiaryEntryNutrition: entry not found: ${id}`);
  return entry;
}
