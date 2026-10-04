/** Diary feature — Today / meal slots / entries (M1-11) + food detail log (M1-13). */
export const DiaryModule = { name: 'diary', status: 'food-detail-m1-13' as const };

// Re-export diary-facing user-data helpers for feature modules
export {
  createDiaryEntry,
  listDiaryEntriesForDay,
  tombstoneDiaryEntry,
  ensureDefaultMealSlots,
  listMealSlots,
  createCustomFood,
  getCustomFood,
  deleteCustomFood,
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
