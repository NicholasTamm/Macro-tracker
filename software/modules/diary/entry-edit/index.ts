/** M1-14 Diary entry edit / delete / undo + immutable snapshot scaling. */
export {
  scaleSnapshotForQuantity,
  type SnapshotQtySource,
  type ScaledQtyResult,
} from './scaleSnapshotForQuantity';

export {
  editDiaryEntryQuantity,
  restoreDiaryEntryNutrition,
  type DiaryNutritionPrev,
  type EditQuantityResult,
} from './editDiaryQuantity';

export {
  deleteDiaryEntry,
  applyDiaryUndo,
  type UndoAction,
  type UndoDeleteAction,
  type UndoEditAction,
  type DeleteResult,
  type UndoResult,
} from './deleteAndUndo';
