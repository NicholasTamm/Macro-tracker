import type { DiaryEntry } from '../app-core/user-data';
import type { NutrientMap } from '../app-core/user-data';

/** Numeric macro strip for MacroSummary (missing nutrient ≠ zero contribution). */
export type DayMacroTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

const KEYS = {
  calories: 'energy_kcal',
  protein: 'protein',
  fat: 'fat_total',
  carbs: 'carbohydrate',
} as const;

function sumKey(maps: NutrientMap[], key: string): number {
  let sum = 0;
  for (const map of maps) {
    const v = map[key];
    if (typeof v === 'number' && !Number.isNaN(v)) sum += v;
  }
  return sum;
}

/** Round for display: whole kcal, one decimal for grams. */
export function roundMacroTotals(totals: DayMacroTotals): DayMacroTotals {
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
  };
}

export function sumMacroTotalsFromSnapshots(snapshots: NutrientMap[]): DayMacroTotals {
  return roundMacroTotals({
    calories: sumKey(snapshots, KEYS.calories),
    protein: sumKey(snapshots, KEYS.protein),
    fat: sumKey(snapshots, KEYS.fat),
    carbs: sumKey(snapshots, KEYS.carbs),
  });
}

export function sumMacroTotalsFromEntries(entries: DiaryEntry[]): DayMacroTotals {
  return sumMacroTotalsFromSnapshots(entries.map((e) => e.nutritionSnapshot));
}
