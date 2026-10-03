/**
 * M1-07: file-based selection, alias overrides, and category quota reporting.
 * Consumes normalized foods from M1-06; does not download or re-normalize.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';
import { normalizeName } from './normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SELECTION_DIR = join(__dirname, '..', 'selection');

const RAW_TOKENS = ['raw', 'uncooked'];
const COOKED_TOKENS = [
  'cooked',
  'roasted',
  'boiled',
  'baked',
  'fried',
  'grilled',
  'steamed',
  'braised',
  'broiled',
  'toasted',
];
const PREP_TOKENS = {
  drained: ['drained'],
  dried: ['dried', 'dehydrated'],
  prepared: ['prepared', 'ready-to-serve', 'ready to serve'],
};

/**
 * Detect preparation state from a USDA-style description.
 * Returns 'raw' | 'cooked' | 'drained' | 'dried' | 'prepared' | null.
 * Raw/cooked tokens are preserved — never collapsed.
 */
export function detectPreparationState(description) {
  const n = normalizeName(description || '');
  if (!n) return null;
  // Prefer explicit raw/cooked when present (including "…, raw" / "…, cooked, …").
  for (const t of RAW_TOKENS) {
    if (new RegExp(`(?:^|\\s)${t}(?:\\s|$)`).test(n)) return 'raw';
  }
  for (const t of COOKED_TOKENS) {
    if (new RegExp(`(?:^|\\s)${t}(?:\\s|$)`).test(n)) return 'cooked';
  }
  for (const [state, tokens] of Object.entries(PREP_TOKENS)) {
    for (const t of tokens) {
      if (n.includes(t)) return state;
    }
  }
  return null;
}

/** True when text contains a token from the opposing preparation family. */
export function hasOpposingPrepTerm(text, foodState) {
  const n = normalizeName(text || '');
  if (!foodState || !n) return false;
  const opposing =
    foodState === 'raw'
      ? COOKED_TOKENS
      : foodState === 'cooked'
        ? RAW_TOKENS
        : [];
  return opposing.some((t) => new RegExp(`(?:^|\\s)${t}(?:\\s|$)`).test(n));
}

function parseCsvText(text) {
  // Drop full-line comments (# …) before parse so example templates stay valid.
  const cleaned = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  return parseCsv(cleaned);
}

export async function loadCategoryQuotas(selectionDir = SELECTION_DIR) {
  const raw = JSON.parse(
    await readFile(join(selectionDir, 'category-quotas.json'), 'utf8'),
  );
  if (!raw.fixture?.categories || !raw.full?.categories) {
    throw new Error('category-quotas.json must define fixture.categories and full.categories');
  }
  return raw;
}

export async function loadSelectionCsv(filePath) {
  const text = await readFile(filePath, 'utf8');
  const rows = parseCsvText(text);
  const byId = new Map();
  for (const row of rows) {
    const foodId = String(row.food_id || '').trim();
    if (!foodId) continue;
    byId.set(foodId, {
      foodId,
      sourceId: row.source_id || null,
      externalId: row.external_id || null,
      category: row.category || null,
      preparationState: row.preparation_state || null,
      notes: row.notes || null,
      reviewer: row.reviewer || null,
      reviewedAt: row.reviewed_at || null,
    });
  }
  return { rows: [...byId.values()], byId };
}

export async function loadAliasOverrides(selectionDir = SELECTION_DIR) {
  const text = await readFile(join(selectionDir, 'aliases-overrides.csv'), 'utf8');
  const rows = parseCsvText(text);
  const allowedTypes = new Set(['reviewed', 'generated', 'regional']);
  /** @type {Array<{foodId:string,alias:string,locale:string,aliasType:string,rankBoost:number,reason:string|null,reviewer:string|null,reviewedAt:string|null}>} */
  const overrides = [];
  for (const row of rows) {
    const foodId = String(row.food_id || '').trim();
    const alias = String(row.alias || '').trim();
    if (!foodId || !alias) continue;
    const aliasType = String(row.alias_type || 'reviewed').trim();
    if (!allowedTypes.has(aliasType)) {
      throw new Error(`aliases-overrides.csv: invalid alias_type "${aliasType}" for ${foodId}`);
    }
    overrides.push({
      foodId,
      alias,
      locale: String(row.locale || 'en').trim() || 'en',
      aliasType,
      rankBoost: Number(row.rank_boost || 0) || 0,
      reason: row.reason || null,
      reviewer: row.reviewer || null,
      reviewedAt: row.reviewed_at || null,
    });
  }
  return overrides;
}

export async function loadRawCookedPairs(selectionDir = SELECTION_DIR) {
  const text = await readFile(join(selectionDir, 'raw-cooked-pairs.csv'), 'utf8');
  const rows = parseCsvText(text);
  return rows
    .map((r) => ({
      rawFoodId: String(r.raw_food_id || '').trim(),
      cookedFoodId: String(r.cooked_food_id || '').trim(),
      staple: r.staple || null,
      notes: r.notes || null,
    }))
    .filter((p) => p.rawFoodId && p.cookedFoodId);
}

/**
 * Filter normalized foods to the reviewed selection set.
 * Foods not in the selection file are dropped (explicit review required).
 */
export function selectFoods(foods, selectionById) {
  const selected = [];
  const missingFromPool = [];
  const seen = new Set();
  for (const id of selectionById.keys()) {
    const hit = foods.find((f) => f.foodId === id);
    if (!hit) {
      missingFromPool.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const meta = selectionById.get(id);
    const preparationState =
      detectPreparationState(hit.description) || meta?.preparationState || null;
    selected.push({
      ...hit,
      // Persist into schema food.state so raw/cooked survives beyond description text.
      state: preparationState || hit.state || null,
      preparationState,
      selectionMeta: meta || null,
    });
  }
  // Stable order by foodId
  selected.sort((a, b) => a.foodId.localeCompare(b.foodId));
  return { foods: selected, missingFromPool };
}

/**
 * Apply file-based alias overrides onto selected foods.
 * Rejects overrides that cross raw↔cooked state.
 */
export function applyAliasOverrides(foods, overrides) {
  const byId = new Map(foods.map((f) => [f.foodId, { ...f, aliases: [...(f.aliases || [])] }]));
  const applied = [];
  const rejected = [];

  for (const ov of overrides) {
    const food = byId.get(ov.foodId);
    if (!food) {
      rejected.push({ ...ov, reason: 'food_not_in_selection' });
      continue;
    }
    const foodState = food.preparationState || detectPreparationState(food.description);
    if (hasOpposingPrepTerm(ov.alias, foodState)) {
      rejected.push({
        ...ov,
        reason: `opposing_prep_term: food is ${foodState}, alias crosses raw/cooked`,
      });
      continue;
    }
    // Salt↔sodium food-name ban (nutrient synonym, not a food alias)
    const aliasNorm = normalizeName(ov.alias);
    if (
      (aliasNorm === 'sodium' && /salt/i.test(food.description)) ||
      (aliasNorm === 'salt' && /sodium/i.test(food.description) && !/salt/i.test(food.description))
    ) {
      rejected.push({ ...ov, reason: 'salt_sodium_cross_alias_forbidden' });
      continue;
    }

    const normalizedAlias = normalizeName(ov.alias);
    const dup = food.aliases.some(
      (a) => a.normalizedAlias === normalizedAlias && a.locale === ov.locale,
    );
    if (!dup) {
      food.aliases.push({
        alias: ov.alias,
        normalizedAlias,
        locale: ov.locale,
        aliasType: ov.aliasType,
        rankBoost: ov.rankBoost,
      });
    }
    applied.push(ov);
  }

  return { foods: [...byId.values()].sort((a, b) => a.foodId.localeCompare(b.foodId)), applied, rejected };
}

/**
 * Quota math: selected_count vs target_min/max per category + totals.
 */
export function computeQuotaReport(selectedFoods, quotaBlock, opts = {}) {
  const counts = new Map();
  for (const f of selectedFoods) {
    const cat = f.category || '(uncategorized)';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  const categories = [];
  let allMet = true;
  for (const q of quotaBlock.categories) {
    const selectedCount = counts.get(q.category) || 0;
    const met = selectedCount >= q.targetMin && selectedCount <= q.targetMax;
    if (!met) allMet = false;
    let status = 'pass';
    if (selectedCount < q.targetMin) status = 'deficit';
    else if (selectedCount > q.targetMax) status = 'over';
    categories.push({
      category: q.category,
      selectedCount,
      targetMin: q.targetMin,
      targetMax: q.targetMax,
      status,
      reviewer: opts.reviewer || null,
      reviewedAt: opts.reviewedAt || null,
    });
  }

  // Categories present in selection but not in quota file → informational
  const known = new Set(quotaBlock.categories.map((c) => c.category));
  const extra = [];
  for (const [cat, n] of counts) {
    if (!known.has(cat)) extra.push({ category: cat, selectedCount: n, status: 'untracked' });
  }

  const total = selectedFoods.length;
  const totalMin = quotaBlock.totalTargetMin ?? 0;
  const totalMax = quotaBlock.totalTargetMax ?? Number.MAX_SAFE_INTEGER;
  const totalMet = total >= totalMin && total <= totalMax;
  if (!totalMet) allMet = false;

  const deficits = categories.filter((c) => c.status === 'deficit' || c.status === 'over');
  if (!totalMet) {
    deficits.push({
      category: '__total__',
      selectedCount: total,
      targetMin: totalMin,
      targetMax: totalMax,
      status: total < totalMin ? 'deficit' : 'over',
    });
  }

  return {
    allMet,
    total: { selectedCount: total, targetMin: totalMin, targetMax: totalMax, met: totalMet },
    categories,
    extraCategories: extra,
    deficits,
  };
}

/**
 * Ensure every raw-cooked pair that is fully listed in the selection still
 * has both members after filtering.
 */
export function checkRawCookedPairs(selectedFoodIds, pairs, selectionById) {
  const selected = new Set(selectedFoodIds);
  const results = [];
  let allOk = true;
  for (const p of pairs) {
    const bothListed =
      selectionById.has(p.rawFoodId) && selectionById.has(p.cookedFoodId);
    if (!bothListed) {
      results.push({
        ...p,
        status: 'not_both_listed',
        message: 'pair not fully listed in selection file — skipped',
      });
      continue;
    }
    const rawOk = selected.has(p.rawFoodId);
    const cookedOk = selected.has(p.cookedFoodId);
    const ok = rawOk && cookedOk;
    if (!ok) allOk = false;
    results.push({
      ...p,
      status: ok ? 'pass' : 'fail',
      rawPresent: rawOk,
      cookedPresent: cookedOk,
      message: ok
        ? 'raw and cooked both survived selection'
        : 'raw/cooked pair broken — both were listed but one missing from output',
    });
  }
  return { allOk, pairs: results };
}

/**
 * Resolve which selection CSV + quota block to use for the build mode.
 */
export function resolveSelectionPaths(mode, selectionDir = SELECTION_DIR) {
  if (mode === 'full') {
    return {
      mode: 'full',
      selectionFile: join(selectionDir, 'selection.full.csv'),
      quotaKey: 'full',
      exampleFile: join(selectionDir, 'selection.full.csv.example'),
    };
  }
  return {
    mode: 'fixture',
    selectionFile: join(selectionDir, 'selection.csv'),
    quotaKey: 'fixture',
    exampleFile: null,
  };
}

/**
 * End-to-end selection step for the build pipeline.
 */
export async function runSelection(foods, opts = {}) {
  const selectionDir = opts.selectionDir || SELECTION_DIR;
  const mode = opts.mode === 'full' ? 'full' : 'fixture';
  const paths = resolveSelectionPaths(mode, selectionDir);
  const quotasDoc = await loadCategoryQuotas(selectionDir);
  const quotaBlock = quotasDoc[paths.quotaKey];
  const pairs = await loadRawCookedPairs(selectionDir);
  const overrides = await loadAliasOverrides(selectionDir);

  let selection;
  try {
    selection = await loadSelectionCsv(paths.selectionFile);
  } catch (err) {
    if (mode === 'full' && err.code === 'ENOENT') {
      const err2 = new Error(
        `USE_FULL_USDA=1 requires ${paths.selectionFile}. Copy selection.full.csv.example → selection.full.csv and add reviewed food_ids. See selection/README.md.`,
      );
      err2.code = 'SELECTION_FULL_MISSING';
      throw err2;
    }
    throw err;
  }

  if (selection.byId.size === 0) {
    const err = new Error(`Selection file ${paths.selectionFile} has no food_id rows`);
    err.code = 'SELECTION_EMPTY';
    throw err;
  }

  const { foods: selected, missingFromPool } = selectFoods(foods, selection.byId);
  const aliased = applyAliasOverrides(selected, overrides);
  const quotaReport = computeQuotaReport(aliased.foods, quotaBlock, {
    reviewer: quotasDoc.reviewer,
    reviewedAt: quotasDoc.reviewedAt,
  });
  const pairCheck = checkRawCookedPairs(
    aliased.foods.map((f) => f.foodId),
    pairs,
    selection.byId,
  );

  const report = {
    version: 1,
    mode,
    selectionFile: paths.selectionFile,
    reviewedAt: quotasDoc.reviewedAt,
    reviewer: quotasDoc.reviewer,
    selectedCount: aliased.foods.length,
    selectionListedCount: selection.byId.size,
    missingFromPool,
    quotas: quotaReport,
    rawCookedPairs: pairCheck,
    aliases: {
      appliedCount: aliased.applied.length,
      rejectedCount: aliased.rejected.length,
      rejected: aliased.rejected,
    },
    ok: quotaReport.allMet && pairCheck.allOk && missingFromPool.length === 0 && aliased.rejected.length === 0,
  };

  // Soft-ok: quota deficits are allowed only when opts.allowDeficitReport and deficits are explicit
  if (!quotaReport.allMet && opts.allowDeficitReport) {
    // Deficit allowance does not waive pair, pool, or alias-rejection failures.
    report.ok =
      pairCheck.allOk &&
      missingFromPool.length === 0 &&
      aliased.rejected.length === 0;
    report.quotaDeficitAllowed = true;
  }

  return {
    foods: aliased.foods,
    report,
    selectionRows: selection.rows,
    categoryQuotaRows: quotaReport.categories,
  };
}
