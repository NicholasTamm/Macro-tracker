/** Diary feature — Today / meal slots / entries (M1-11). */
export const DiaryModule = { name: 'diary', status: 'today-m1-11' as const };

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
} from './dayKey';

export {
  sumMacroTotalsFromEntries,
  sumMacroTotalsFromSnapshots,
  roundMacroTotals,
  type DayMacroTotals,
} from './macroTotals';

export { loadTodayDay, type TodayDayView, type MealSlotSection } from './loadTodayDay';
