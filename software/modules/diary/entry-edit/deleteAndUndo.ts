/**
 * Soft-delete diary entries and undo (restore / revert edit).
 */

import {
  getDiaryEntry,
  restoreDiaryEntry,
  tombstoneDiaryEntry,
  type DiaryEntry,
  type SqlExecutor,
} from '../../app-core/user-data';
import {
  restoreDiaryEntryNutrition,
  type DiaryNutritionPrev,
} from './editDiaryQuantity';

export type UndoDeleteAction = {
  kind: 'delete';
  entryId: string;
  foodDisplayName: string;
};

export type UndoEditAction = {
  kind: 'edit';
  entryId: string;
  foodDisplayName: string;
  previous: DiaryNutritionPrev;
};

export type UndoAction = UndoDeleteAction | UndoEditAction;

export type DeleteResult =
  | { ok: true; undo: UndoDeleteAction }
  | { ok: false; reason: string };

export function deleteDiaryEntry(db: SqlExecutor, entryId: string): DeleteResult {
  const entry = getDiaryEntry(db, entryId);
  if (!entry) {
    return { ok: false, reason: 'Entry not found.' };
  }
  tombstoneDiaryEntry(db, entryId);
  return {
    ok: true,
    undo: {
      kind: 'delete',
      entryId,
      foodDisplayName: entry.foodDisplayName,
    },
  };
}

export type UndoResult =
  | { ok: true; entry: DiaryEntry | null }
  | { ok: false; reason: string };

export function applyDiaryUndo(db: SqlExecutor, action: UndoAction): UndoResult {
  if (action.kind === 'delete') {
    const entry = restoreDiaryEntry(db, action.entryId);
    if (!entry) {
      return { ok: false, reason: 'Could not restore deleted entry.' };
    }
    return { ok: true, entry };
  }
  const result = restoreDiaryEntryNutrition(db, action.entryId, action.previous);
  if (!result.ok) return result;
  return { ok: true, entry: result.entry };
}
