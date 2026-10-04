/** Diary feature — Today / meal slots / entries (M1-11) + food detail log (M1-13). */
export const DiaryModule = { name: 'diary', status: 'custom-food-m1-15' as const };

// Re-export diary-facing user-data helpers for feature modules
export {
  createDiaryEntry,
  listDiaryEntriesForDay,
  getDiaryEntry,
  tombstoneDiaryEntry,
  restoreDiaryEntry,
  updateDiaryEntryNutrition,
  ensureDefaultMealSlots,
  listMealSlots,
  createCustomFood,
  getCustomFood,
  updateCustomFood,
  deleteCustomFood,
  archiveCustomFood,
  unarchiveCustomFood,
  listCustomFoods,
  type DiaryEntry,
  type CustomFood,
} from '../app-core/user-data';

export {
  localDayKeyFromDate,
  parseDayKey,
  shiftDayKey,
  formatDayLabel,
  formatEntryTime,
  localTimeHHMM,
  parseLocalTimeHHMM,
  timestampFromLocalDayAndTime,
} from './dayKey';

export {
  sumMacroTotalsFromEntries,
  sumMacroTotalsFromSnapshots,
  roundMacroTotals,
  type DayMacroTotals,
} from './macroTotals';

export { loadTodayDay, type TodayDayView, type MealSlotSection } from './loadTodayDay';

export {
  parseQuantityInput,
  quantityErrorMessage,
  isValidQuantity,
  roundNutrientValue,
  scaleNutrientsPer100g,
  scaleNutrientsByFactor,
  nutrientMapFromRows,
  resolveSeedAmount,
  resolveCustomAmount,
  buildSeedFoodDetail,
  buildCustomFoodDetail,
  unitChoiceFromSelection,
  gramsUnitAvailable,
  computeLiveNutrients,
  logFoodToDiary,
  type FoodDetailModel,
  type UnitChoice,
  type ServingChoice,
  type LogFoodResult,
  type QuantityParseResult,
} from './food-detail';

export {
  scaleSnapshotForQuantity,
  editDiaryEntryQuantity,
  restoreDiaryEntryNutrition,
  deleteDiaryEntry,
  applyDiaryUndo,
  type UndoAction,
  type DiaryNutritionPrev,
  type EditQuantityResult,
} from './entry-edit';

export {
  validateCustomFoodDraft,
  saveCustomFoodCreate,
  saveCustomFoodEdit,
  archiveCustomFoodSafe,
  CustomFoodEditorSheet,
  type CustomFoodDraft,
  type SaveCustomFoodResult,
} from './custom-food';
