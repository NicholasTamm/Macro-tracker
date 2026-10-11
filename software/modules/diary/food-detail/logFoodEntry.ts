/**
 * Atomically log a food detail selection into the diary (Today)
 * and upsert recent_food (last qty/unit) in the same transaction (M1-16).
 */

import {
  createDiaryEntry,
  ensureDefaultMealSlots,
  getDiaryEntry,
  recordRecentFood,
  type DiaryEntry,
  type FoodKind,
  type SqlExecutor,
} from '../../app-core/user-data';
import { localDayKeyFromDate } from '../dayKey';
import type { FoodDetailModel } from './buildFoodDetail';
import { computeLiveNutrients } from './computeLiveNutrients';
import { isValidQuantity } from './parseQuantity';
import type { UnitChoice } from './resolveAmount';

export type LogFoodInput = {
  /** Stable ID for one UI log intent. Replays return the original row. */
  intentId?: string;
  model: FoodDetailModel;
  quantity: number;
  unit: UnitChoice;
  mealSlotId: string | null;
  /** ISO timestamp; defaults to now. */
  timestamp?: string;
  /** Local day key; defaults from timestamp / now. */
  localDayKey?: string;
  timezoneIdentifier?: string;
};

export type LogFoodResult =
  | { ok: true; entry: DiaryEntry }
  | { ok: false; reason: string };

function withTransaction<T>(db: SqlExecutor, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw e;
  }
}

/**
 * Validate, compute immutable nutrition snapshot, insert diary_entry,
 * and upsert recent_food in one transaction.
 */
export function logFoodToDiary(db: SqlExecutor, input: LogFoodInput): LogFoodResult {
  if (!isValidQuantity(input.quantity)) {
    return { ok: false, reason: 'Quantity must be greater than zero.' };
  }

  const preview = computeLiveNutrients(input.model, input.quantity, input.unit);
  if (!preview.ok) {
    return { ok: false, reason: preview.reason };
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const localDayKey =
    input.localDayKey ?? localDayKeyFromDate(new Date(timestamp));
  const timezoneIdentifier =
    input.timezoneIdentifier ??
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC');

  const foodKind: FoodKind = input.model.kind === 'seed' ? 'seed' : 'custom';

  try {
    const entry = withTransaction(db, () => {
      ensureDefaultMealSlots(db);
      if (input.intentId) {
        const existing = getDiaryEntry(db, input.intentId, { includeDeleted: true });
        if (existing) return existing;
      }
      const created = createDiaryEntry(db, {
        id: input.intentId,
        timestamp,
        localDayKey,
        timezoneIdentifier,
        mealSlotId: input.mealSlotId,
        foodKind,
        foodStableId: input.model.foodStableId,
        foodDisplayName: input.model.displayName,
        foodLicenseTag: input.model.licenseTag,
        quantity: preview.quantity,
        unitLabel: preview.unitLabel,
        grams: preview.grams,
        nutritionSnapshot: preview.nutritionSnapshot,
        sourceDisplayName: input.model.sourceDisplayName,
        licenseTag: input.model.licenseTag,
      });
      recordRecentFood(db, {
        foodKind,
        foodStableId: input.model.foodStableId,
        foodDisplayName: input.model.displayName,
        foodLicenseTag: input.model.licenseTag,
        foodBrand: input.model.brand,
        quantity: preview.quantity,
        unit: preview.unitLabel,
        usedAt: timestamp,
      });
      return created;
    });
    return { ok: true, entry };
  } catch (e) {
    if (input.intentId) {
      const existing = getDiaryEntry(db, input.intentId, { includeDeleted: true });
      if (existing) return { ok: true, entry: existing };
    }
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
