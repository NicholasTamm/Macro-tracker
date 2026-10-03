/**
 * Atomically log a food detail selection into the diary (Today).
 * Does not implement edit/delete/undo (M1-14).
 */

import {
  createDiaryEntry,
  ensureDefaultMealSlots,
  type DiaryEntry,
  type SqlExecutor,
} from '../../app-core/user-data';
import { localDayKeyFromDate } from '../dayKey';
import type { FoodDetailModel } from './buildFoodDetail';
import { computeLiveNutrients } from './computeLiveNutrients';
import { isValidQuantity } from './parseQuantity';
import type { UnitChoice } from './resolveAmount';

export type LogFoodInput = {
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
 * Validate, compute immutable nutrition snapshot, and insert diary_entry in one transaction.
 * Today readers (loadTodayDay) see the new row after commit.
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

  const foodKind = input.model.kind === 'seed' ? 'seed' : 'custom';

  try {
    const entry = withTransaction(db, () => {
      ensureDefaultMealSlots(db);
      return createDiaryEntry(db, {
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
    });
    return { ok: true, entry };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
