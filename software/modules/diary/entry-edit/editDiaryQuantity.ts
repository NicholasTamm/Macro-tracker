/**
 * Edit diary entry quantity — recalculates from immutable nutrition snapshot.
 */

import {
  getDiaryEntry,
  updateDiaryEntryNutrition,
  type DiaryEntry,
  type NutrientMap,
  type SqlExecutor,
} from '../../app-core/user-data';
import { isValidQuantity } from '../food-detail/parseQuantity';
import { scaleSnapshotForQuantity } from './scaleSnapshotForQuantity';

export type DiaryNutritionPrev = {
  quantity: number;
  grams: number | null;
  nutritionSnapshot: NutrientMap;
};

export type EditQuantityResult =
  | { ok: true; entry: DiaryEntry; previous: DiaryNutritionPrev }
  | { ok: false; reason: string };

export function editDiaryEntryQuantity(
  db: SqlExecutor,
  entryId: string,
  newQuantity: number,
): EditQuantityResult {
  if (!isValidQuantity(newQuantity)) {
    return { ok: false, reason: 'Quantity must be greater than zero.' };
  }
  const current = getDiaryEntry(db, entryId);
  if (!current) {
    return { ok: false, reason: 'Entry not found.' };
  }
  if (newQuantity === current.quantity) {
    return {
      ok: true,
      entry: current,
      previous: {
        quantity: current.quantity,
        grams: current.grams,
        nutritionSnapshot: { ...current.nutritionSnapshot },
      },
    };
  }

  try {
    const previous: DiaryNutritionPrev = {
      quantity: current.quantity,
      grams: current.grams,
      nutritionSnapshot: { ...current.nutritionSnapshot },
    };
    const scaled = scaleSnapshotForQuantity(current, newQuantity);
    const entry = updateDiaryEntryNutrition(db, entryId, {
      quantity: scaled.quantity,
      grams: scaled.grams,
      nutritionSnapshot: scaled.nutritionSnapshot,
    });
    return { ok: true, entry, previous };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Restore a prior quantity/snapshot (undo edit) without re-deriving from seed/custom. */
export function restoreDiaryEntryNutrition(
  db: SqlExecutor,
  entryId: string,
  previous: DiaryNutritionPrev,
): EditQuantityResult {
  const current = getDiaryEntry(db, entryId);
  if (!current) {
    return { ok: false, reason: 'Entry not found.' };
  }
  try {
    const entry = updateDiaryEntryNutrition(db, entryId, {
      quantity: previous.quantity,
      grams: previous.grams,
      nutritionSnapshot: previous.nutritionSnapshot,
    });
    return {
      ok: true,
      entry,
      previous: {
        quantity: current.quantity,
        grams: current.grams,
        nutritionSnapshot: { ...current.nutritionSnapshot },
      },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
