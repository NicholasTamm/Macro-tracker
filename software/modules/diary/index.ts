/** Diary feature — Today / meal slots / entries (M1-05+). */
export const DiaryModule = { name: 'diary', status: 'user-store-v1' as const };

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
