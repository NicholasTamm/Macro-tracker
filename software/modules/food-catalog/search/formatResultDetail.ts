/**
 * Format Search result detail line: source + per-100 g macros (M1-12).
 * Example: "USDA SR Legacy · 89 Cal · 1P · 0F · 23C · per 100 g"
 */
import { formatEnergy } from '../../app-core/settings/unitDisplay';
import type { EnergyUnit } from '../../app-core/user-data/profileTypes';

export type MacroPer100g = {
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
};

function fmtNum(n: number | null, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (digits === 0) return String(Math.round(n));
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

/** Compact macro fragment used in FoodRow detail. */
export function formatMacrosPer100g(
  m: MacroPer100g,
  energyUnit: EnergyUnit = 'kcal',
): string {
  const energy = m.energyKcal == null || Number.isNaN(m.energyKcal)
    ? '—'
    : formatEnergy(m.energyKcal, energyUnit);
  return `${energy} ${energyUnit} · ${fmtNum(m.proteinG)}P · ${fmtNum(m.fatG)}F · ${fmtNum(m.carbG)}C · per 100 g`;
}

export function formatResultDetail(
  sourceLabel: string,
  m: MacroPer100g,
  energyUnit: EnergyUnit = 'kcal',
): string {
  const src = sourceLabel.trim() || 'Unknown source';
  return `${src} · ${formatMacrosPer100g(m, energyUnit)}`;
}

export function macrosFromNutrientRows(
  rows: ReadonlyArray<{ nutrientId: string; amountPer100g: number }>,
): MacroPer100g {
  const byId = new Map(rows.map((r) => [r.nutrientId, r.amountPer100g]));
  return {
    energyKcal: byId.has('energy_kcal') ? Number(byId.get('energy_kcal')) : null,
    proteinG: byId.has('protein') ? Number(byId.get('protein')) : null,
    fatG: byId.has('fat_total') ? Number(byId.get('fat_total')) : null,
    carbG: byId.has('carbohydrate') ? Number(byId.get('carbohydrate')) : null,
  };
}

export function macrosFromNutrientMap(
  map: Record<string, number | null | undefined>,
): MacroPer100g {
  const pick = (k: string): number | null => {
    if (!Object.prototype.hasOwnProperty.call(map, k)) return null;
    const v = map[k];
    return v == null || Number.isNaN(Number(v)) ? null : Number(v);
  };
  return {
    energyKcal: pick('energy_kcal'),
    proteinG: pick('protein'),
    fatG: pick('fat_total'),
    carbG: pick('carbohydrate'),
  };
}
