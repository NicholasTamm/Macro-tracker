import {
  ensureDefaultMealSlots,
  getLatestTarget,
  listDiaryEntriesForDay,
  listMealSlots,
  type DiaryEntry,
  type SqlExecutor,
} from '../app-core/user-data';
import { sumMacroTotalsFromEntries, type DayMacroTotals } from './macroTotals';

export type MealSlotSection = {
  id: string;
  name: string;
  sortOrder: number;
  entries: DiaryEntry[];
  subtotals: DayMacroTotals;
};

export type TodayDayView = {
  localDayKey: string;
  slots: MealSlotSection[];
  /** Entries with null mealSlotId — still shown; timestamp is authoritative. */
  unscheduled: DiaryEntry[];
  unscheduledSubtotals: DayMacroTotals;
  totals: DayMacroTotals;
  goals: {
    calorieGoal?: number;
    proteinGoal?: number;
    fatGoal?: number;
    carbsGoal?: number;
  };
  entryCount: number;
};

/**
 * Load offline Today view for a local day key.
 * Groups by meal_slot_id (not by timestamp). Timestamps remain entry-owned.
 */
export function loadTodayDay(db: SqlExecutor, localDayKey: string): TodayDayView {
  ensureDefaultMealSlots(db);
  const slotsMeta = listMealSlots(db);
  const entries = listDiaryEntriesForDay(db, localDayKey);
  const bySlot = new Map<string, DiaryEntry[]>();
  const unscheduled: DiaryEntry[] = [];

  for (const entry of entries) {
    if (entry.mealSlotId == null) {
      unscheduled.push(entry);
      continue;
    }
    const list = bySlot.get(entry.mealSlotId) ?? [];
    list.push(entry);
    bySlot.set(entry.mealSlotId, list);
  }

  // Keep chronological order within each slot (repo already orders by timestamp).
  const slots: MealSlotSection[] = slotsMeta.map((s) => {
    const slotEntries = bySlot.get(s.id) ?? [];
    return {
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      entries: slotEntries,
      subtotals: sumMacroTotalsFromEntries(slotEntries),
    };
  });

  const target = getLatestTarget(db);
  const totals = sumMacroTotalsFromEntries(entries);

  return {
    localDayKey,
    slots,
    unscheduled,
    unscheduledSubtotals: sumMacroTotalsFromEntries(unscheduled),
    totals,
    goals: target
      ? {
          calorieGoal: Math.round(target.energyKcal),
          proteinGoal: Math.round(target.proteinG),
          fatGoal: Math.round(target.fatG),
          carbsGoal: Math.round(target.carbohydrateG),
        }
      : {},
    entryCount: entries.length,
  };
}
