/**
 * Live nutrient math: scale per-100 g (or per-basis) maps by grams / factor.
 * Missing/null nutrients stay missing/null — never coerced to zero.
 */

import type { NutrientMap } from '../../app-core/user-data';

/** Round helpers for golden / snapshot stability. */
export function roundNutrientValue(nutrientId: string, value: number): number {
  // Energy: 1 decimal kcal; gram macros: 2; micronutrients (mg/ug): 1.
  const decimals =
    nutrientId === 'energy_kcal'
      ? 1
      : nutrientId === 'protein' ||
          nutrientId === 'carbohydrate' ||
          nutrientId === 'fat_total' ||
          nutrientId === 'fiber' ||
          nutrientId === 'sugars_total' ||
          nutrientId === 'fat_saturated' ||
          nutrientId === 'fat_monounsaturated' ||
          nutrientId === 'fat_polyunsaturated' ||
          nutrientId === 'fat_trans' ||
          nutrientId === 'water' ||
          nutrientId === 'alcohol'
        ? 2
        : 1;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Scale a per-100 g nutrient map by logged grams.
 * `snapshot[k] = per100g[k] * (grams / 100)` when numeric; null stays null; omitted stays omitted.
 */
export function scaleNutrientsPer100g(
  per100g: NutrientMap,
  grams: number,
  opts: { round?: boolean } = {},
): NutrientMap {
  if (!(typeof grams === 'number' && Number.isFinite(grams) && grams > 0)) {
    throw new Error(`scaleNutrientsPer100g: grams must be a positive finite number (got ${String(grams)})`);
  }
  const factor = grams / 100;
  const out: NutrientMap = {};
  const doRound = opts.round !== false;
  for (const [k, v] of Object.entries(per100g)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = null;
      continue;
    }
    if (typeof v !== 'number' || Number.isNaN(v)) {
      throw new Error(`Invalid nutrient value for ${k}: ${String(v)}`);
    }
    const scaled = v * factor;
    out[k] = doRound ? roundNutrientValue(k, scaled) : scaled;
  }
  return out;
}

/**
 * Scale nutrients stored for a custom-food basis by (quantity / basisAmount).
 * Used when logging in the food's basis unit (not grams).
 */
export function scaleNutrientsByFactor(
  basisNutrients: NutrientMap,
  factor: number,
  opts: { round?: boolean } = {},
): NutrientMap {
  if (!(typeof factor === 'number' && Number.isFinite(factor) && factor > 0)) {
    throw new Error(`scaleNutrientsByFactor: factor must be a positive finite number (got ${String(factor)})`);
  }
  const out: NutrientMap = {};
  const doRound = opts.round !== false;
  for (const [k, v] of Object.entries(basisNutrients)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = null;
      continue;
    }
    if (typeof v !== 'number' || Number.isNaN(v)) {
      throw new Error(`Invalid nutrient value for ${k}: ${String(v)}`);
    }
    const scaled = v * factor;
    out[k] = doRound ? roundNutrientValue(k, scaled) : scaled;
  }
  return out;
}

/** Convert nutrient rows from LocalFoodRepository into a NutrientMap (per 100 g). */
export function nutrientMapFromRows(
  rows: Array<{ nutrientId: string; amountPer100g: number | null }>,
): NutrientMap {
  const out: NutrientMap = {};
  for (const row of rows) {
    out[row.nutrientId] =
      row.amountPer100g === null || Number.isNaN(row.amountPer100g)
        ? null
        : Number(row.amountPer100g);
  }
  return out;
}
