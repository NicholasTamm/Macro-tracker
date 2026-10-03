import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsvFile } from './csv.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SEED_ROOT = join(__dirname, '..');

export const FOUNDATION_DATA_TYPE = 'foundation_food';
export const SR_LEGACY_DATA_TYPE = 'sr_legacy_food';

export const DATA_TYPE_TO_SOURCE = {
  foundation_food: {
    sourceId: 'usda-foundation',
    dataType: 'foundation',
    foodIdPrefix: 'usda-foundation',
  },
  sr_legacy_food: {
    sourceId: 'usda-sr-legacy',
    dataType: 'sr_legacy',
    foodIdPrefix: 'usda-sr-legacy',
  },
};

/** @param {string} description */
export function normalizeName(description) {
  return String(description)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[%/_|]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prefer USDA Energy (1008 / nbr 208); fall back to Atwater General (2047).
 * @param {Map<string, { amount: number, derivation?: string|null, min?: number|null, max?: number|null, dataPoints?: number|null }>} byNutrientId
 * @param {string[]} energyPreference
 */
export function pickEnergy(byNutrientId, energyPreference) {
  for (const id of energyPreference) {
    if (byNutrientId.has(id)) return { nutrientId: id, ...byNutrientId.get(id) };
  }
  return null;
}

/**
 * Map USDA food_nutrient rows → canonical nutrient amounts (per 100 g).
 * Missing stays absent (not zero). Explicit 0 is kept.
 */
export function mapNutrients(foodNutrientRows, nutrientMap) {
  /** @type {Map<string, { amount: number, derivation?: string|null, min?: number|null, max?: number|null, dataPoints?: number|null, sourceNutrientId: string }>} */
  const byUsdaId = new Map();
  for (const row of foodNutrientRows) {
    const nid = String(row.nutrient_id);
    const amountRaw = row.amount;
    if (amountRaw === '' || amountRaw == null) continue;
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) continue;
    byUsdaId.set(nid, {
      amount,
      derivation: row.derivation_id || null,
      min: row.min === '' || row.min == null ? null : Number(row.min),
      max: row.max === '' || row.max == null ? null : Number(row.max),
      dataPoints: row.data_points === '' || row.data_points == null ? null : Number(row.data_points),
      sourceNutrientId: nid,
    });
  }

  /** @type {Map<string, { amount: number, derivation?: string|null, min?: number|null, max?: number|null, dataPoints?: number|null, sourceNutrientId: string }>} */
  const canonical = new Map();
  const energyPref = nutrientMap.energyPreference || ['1008', '2047'];

  // Energy first with preference
  const energy = pickEnergy(byUsdaId, energyPref);
  if (energy) {
    const spec = nutrientMap.byNutrientId[energy.nutrientId];
    if (spec) {
      canonical.set(spec.id, {
        amount: energy.amount,
        derivation: energy.derivation,
        min: energy.min,
        max: energy.max,
        dataPoints: energy.dataPoints,
        sourceNutrientId: energy.sourceNutrientId,
      });
    }
  }

  for (const [usdaId, spec] of Object.entries(nutrientMap.byNutrientId)) {
    if (spec.fallbackOnly) continue;
    if (spec.id === 'energy_kcal' && canonical.has('energy_kcal')) continue;
    const hit = byUsdaId.get(usdaId);
    if (!hit) continue;
    if (canonical.has(spec.id)) continue;
    canonical.set(spec.id, hit);
  }

  return canonical;
}

export function makeFoodId(prefix, fdcId) {
  return `${prefix}:${fdcId}`;
}

export function contentHash(parts) {
  const payload = JSON.stringify(parts);
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Load a USDA-shaped directory (food.csv, food_nutrient.csv, …) and normalize.
 * @param {string} dirPath
 * @param {{ allowedFdcIds?: Set<string>|null, nutrientMap?: object, limit?: number|null }} [opts]
 */
export async function normalizeUsdaDirectory(dirPath, opts = {}) {
  const nutrientMap =
    opts.nutrientMap ||
    JSON.parse(await readFile(join(SEED_ROOT, 'nutrient-map.json'), 'utf8'));

  const foodRows = await readCsvFile(join(dirPath, 'food.csv'));
  const nutrientRows = await readCsvFile(join(dirPath, 'food_nutrient.csv'));
  const portionRows = await readCsvFile(join(dirPath, 'food_portion.csv'));
  let categoryRows = [];
  try {
    categoryRows = await readCsvFile(join(dirPath, 'food_category.csv'));
  } catch {
    categoryRows = [];
  }
  let unitRows = [];
  try {
    unitRows = await readCsvFile(join(dirPath, 'measure_unit.csv'));
  } catch {
    unitRows = [];
  }

  const categories = new Map(categoryRows.map((r) => [String(r.id), r.description]));
  const units = new Map(unitRows.map((r) => [String(r.id), r.name]));

  const allowed = opts.allowedFdcIds || null;
  const foods = foodRows.filter((r) => {
    if (r.data_type !== FOUNDATION_DATA_TYPE && r.data_type !== SR_LEGACY_DATA_TYPE) return false;
    if (allowed && !allowed.has(String(r.fdc_id))) return false;
    return true;
  });

  if (opts.limit != null) {
    foods.splice(opts.limit);
  }

  const fdcIds = new Set(foods.map((f) => String(f.fdc_id)));
  /** @type {Map<string, typeof nutrientRows>} */
  const nutrientsByFood = new Map();
  for (const row of nutrientRows) {
    const fid = String(row.fdc_id);
    if (!fdcIds.has(fid)) continue;
    if (!nutrientsByFood.has(fid)) nutrientsByFood.set(fid, []);
    nutrientsByFood.get(fid).push(row);
  }
  /** @type {Map<string, typeof portionRows>} */
  const portionsByFood = new Map();
  for (const row of portionRows) {
    const fid = String(row.fdc_id);
    if (!fdcIds.has(fid)) continue;
    if (!portionsByFood.has(fid)) portionsByFood.set(fid, []);
    portionsByFood.get(fid).push(row);
  }

  const REQUIRED = ['energy_kcal', 'protein', 'carbohydrate', 'fat_total'];
  const normalizedFoods = [];
  const rejected = [];

  for (const food of foods) {
    const meta = DATA_TYPE_TO_SOURCE[food.data_type];
    if (!meta) continue;
    const fdcId = String(food.fdc_id);
    const nutrients = mapNutrients(nutrientsByFood.get(fdcId) || [], nutrientMap);
    const missingRequired = REQUIRED.filter((id) => !nutrients.has(id));
    if (missingRequired.length) {
      rejected.push({ fdcId, description: food.description, missingRequired });
      continue;
    }

    const portions = (portionsByFood.get(fdcId) || [])
      .map((p, idx) => {
        const gramWeight = Number(p.gram_weight);
        const quantity = Number(p.amount || p.seq_num || 1);
        if (!Number.isFinite(gramWeight) || gramWeight <= 0) return null;
        const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
        const unitName = units.get(String(p.measure_unit_id)) || 'serving';
        const unit =
          unitName === 'undetermined' && p.modifier
            ? String(p.modifier)
            : unitName === 'undetermined'
              ? 'serving'
              : unitName;
        return {
          sequence: Number(p.seq_num) || idx + 1,
          quantity: qty,
          unit,
          modifier: p.modifier || null,
          gramWeight,
          sourceMeasureId: p.id || null,
          isDefault: false,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sequence - b.sequence);

    if (portions.length === 0) {
      portions.push({
        sequence: 1,
        quantity: 100,
        unit: 'g',
        modifier: null,
        gramWeight: 100,
        sourceMeasureId: null,
        isDefault: true,
      });
    } else {
      portions[0].isDefault = true;
    }

    const foodId = makeFoodId(meta.foodIdPrefix, fdcId);
    const description = food.description;
    const normalized = normalizeName(description);
    const category = categories.get(String(food.food_category_id)) || null;
    const nutrientObj = {};
    for (const [k, v] of nutrients) nutrientObj[k] = v.amount;

    const hash = contentHash({
      foodId,
      description,
      nutrientObj,
      portions: portions.map((p) => [p.sequence, p.quantity, p.unit, p.gramWeight]),
    });

    normalizedFoods.push({
      foodId,
      sourceId: meta.sourceId,
      externalId: fdcId,
      dataType: meta.dataType,
      description,
      normalizedName: normalized,
      category,
      scientificName: null,
      state: null,
      ediblePortionPct: null,
      sourceModifiedAt: food.publication_date || null,
      contentHash: hash,
      nutrients: [...nutrients.entries()].map(([nutrientId, v]) => ({
        nutrientId,
        amountPer100g: v.amount,
        derivationCode: v.derivation,
        minValue: v.min,
        maxValue: v.max,
        dataPoints: v.dataPoints,
        sourceNutrientId: v.sourceNutrientId,
      })),
      servings: portions,
      aliases: [
        {
          alias: description,
          normalizedAlias: normalized,
          locale: 'en',
          aliasType: 'source',
          rankBoost: 0,
        },
      ],
    });
  }

  return { foods: normalizedFoods, rejected, nutrientMap };
}

export async function loadPinnedSources() {
  return JSON.parse(await readFile(join(SEED_ROOT, 'pinned-sources.json'), 'utf8'));
}

export async function loadNutrientMap() {
  return JSON.parse(await readFile(join(SEED_ROOT, 'nutrient-map.json'), 'utf8'));
}
