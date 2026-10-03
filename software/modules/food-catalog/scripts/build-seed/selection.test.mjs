import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { normalizeUsdaDirectory } from './lib/normalize.mjs';
import {
  detectPreparationState,
  hasOpposingPrepTerm,
  loadCategoryQuotas,
  loadSelectionCsv,
  loadAliasOverrides,
  loadRawCookedPairs,
  selectFoods,
  applyAliasOverrides,
  computeQuotaReport,
  checkRawCookedPairs,
  runSelection,
  SELECTION_DIR,
} from './lib/selection.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('detectPreparationState keeps raw vs cooked distinct', () => {
  assert.equal(
    detectPreparationState('Chicken, breast, meat only, raw'),
    'raw',
  );
  assert.equal(
    detectPreparationState('Chicken, breast, meat only, cooked, roasted'),
    'cooked',
  );
  assert.equal(detectPreparationState('Bananas, raw'), 'raw');
  assert.equal(detectPreparationState('Rice, brown, long-grain, cooked'), 'cooked');
  assert.equal(detectPreparationState('Oil, olive, salad or cooking'), null);
});

test('hasOpposingPrepTerm blocks raw↔cooked alias cross', () => {
  assert.equal(hasOpposingPrepTerm('chicken breast cooked', 'raw'), true);
  assert.equal(hasOpposingPrepTerm('chicken breast raw', 'cooked'), true);
  assert.equal(hasOpposingPrepTerm('chicken breast raw', 'raw'), false);
  assert.equal(hasOpposingPrepTerm('olive oil', 'raw'), false);
});

test('selection.csv lists golden fixture food_ids', async () => {
  const sel = await loadSelectionCsv(join(SELECTION_DIR, 'selection.csv'));
  assert.equal(sel.byId.size, 14);
  assert.ok(sel.byId.has('usda-foundation:748967'));
  assert.ok(sel.byId.has('usda-sr-legacy:171077'));
  assert.ok(sel.byId.has('usda-sr-legacy:171079'));
  assert.ok(sel.byId.has('usda-sr-legacy:168875'));
  assert.ok(sel.byId.has('usda-sr-legacy:168878'));
});

test('quota math: met vs deficit', () => {
  const block = {
    totalTargetMin: 2,
    totalTargetMax: 10,
    categories: [
      { category: 'Fruits and Fruit Juices', targetMin: 1, targetMax: 3 },
      { category: 'Poultry Products', targetMin: 2, targetMax: 4 },
    ],
  };
  const foods = [
    { category: 'Fruits and Fruit Juices' },
    { category: 'Poultry Products' },
  ];
  const deficit = computeQuotaReport(foods, block);
  assert.equal(deficit.allMet, false);
  assert.equal(deficit.categories.find((c) => c.category === 'Poultry Products').status, 'deficit');

  const okFoods = [
    { category: 'Fruits and Fruit Juices' },
    { category: 'Poultry Products' },
    { category: 'Poultry Products' },
  ];
  const ok = computeQuotaReport(okFoods, block);
  assert.equal(ok.allMet, true);
  assert.equal(ok.total.selectedCount, 3);
});

test('selectFoods + raw/cooked pairs survive when both listed', async () => {
  const foundation = await normalizeUsdaDirectory(join(__dirname, 'fixture/foundation'));
  const sr = await normalizeUsdaDirectory(join(__dirname, 'fixture/sr_legacy'));
  const pool = [...foundation.foods, ...sr.foods];
  const sel = await loadSelectionCsv(join(SELECTION_DIR, 'selection.csv'));
  const { foods, missingFromPool } = selectFoods(pool, sel.byId);
  assert.equal(missingFromPool.length, 0);
  assert.equal(foods.length, 14);

  const chickenRaw = foods.find((f) => f.foodId === 'usda-sr-legacy:171077');
  const chickenCooked = foods.find((f) => f.foodId === 'usda-sr-legacy:171079');
  assert.ok(chickenRaw);
  assert.ok(chickenCooked);
  assert.equal(detectPreparationState(chickenRaw.description), 'raw');
  assert.equal(detectPreparationState(chickenCooked.description), 'cooked');
  assert.equal(chickenRaw.state, 'raw');
  assert.equal(chickenCooked.state, 'cooked');

  const pairs = await loadRawCookedPairs();
  const check = checkRawCookedPairs(
    foods.map((f) => f.foodId),
    pairs,
    sel.byId,
  );
  assert.equal(check.allOk, true);
  assert.ok(check.pairs.every((p) => p.status === 'pass'));
});

test('applyAliasOverrides is file-based and rejects raw→cooked cross', async () => {
  const foundation = await normalizeUsdaDirectory(join(__dirname, 'fixture/foundation'));
  const sr = await normalizeUsdaDirectory(join(__dirname, 'fixture/sr_legacy'));
  const sel = await loadSelectionCsv(join(SELECTION_DIR, 'selection.csv'));
  const { foods } = selectFoods([...foundation.foods, ...sr.foods], sel.byId);
  // stamp prep state like runSelection does
  for (const f of foods) {
    f.preparationState = detectPreparationState(f.description);
  }

  const overrides = await loadAliasOverrides();
  const good = applyAliasOverrides(foods, overrides);
  assert.ok(good.applied.length >= 8);
  assert.equal(good.rejected.length, 0);
  const banana = good.foods.find((f) => f.foodId === 'usda-sr-legacy:173944');
  assert.ok(banana.aliases.some((a) => a.normalizedAlias === 'banana' && a.aliasType === 'reviewed'));

  const bad = applyAliasOverrides(foods, [
    {
      foodId: 'usda-sr-legacy:171077',
      alias: 'chicken breast cooked',
      locale: 'en',
      aliasType: 'reviewed',
      rankBoost: 1,
      reason: 'should fail',
      reviewer: 'test',
      reviewedAt: '2026-10-03',
    },
  ]);
  assert.equal(bad.applied.length, 0);
  assert.equal(bad.rejected.length, 1);
  assert.match(bad.rejected[0].reason, /opposing_prep_term/);
});

test('runSelection on fixture pool meets quotas and writes-shaped report', async () => {
  const foundation = await normalizeUsdaDirectory(join(__dirname, 'fixture/foundation'));
  const sr = await normalizeUsdaDirectory(join(__dirname, 'fixture/sr_legacy'));
  const result = await runSelection([...foundation.foods, ...sr.foods], { mode: 'fixture' });
  assert.equal(result.foods.length, 14);
  assert.equal(result.report.ok, true);
  assert.equal(result.report.quotas.allMet, true);
  const rawChicken = result.foods.find((f) => f.foodId === 'usda-sr-legacy:171077');
  assert.equal(rawChicken.state, 'raw');
  assert.equal(result.report.rawCookedPairs.allOk, true);
  assert.equal(result.report.missingFromPool.length, 0);
  assert.ok(result.report.aliases.appliedCount >= 8);

  const quotas = await loadCategoryQuotas();
  assert.equal(quotas.fixture.categories.length, 11);
  assert.equal(quotas.full.totalTargetMin, 2000);
  assert.equal(quotas.full.totalTargetMax, 5000);
});

test('aliases-overrides.csv is reviewable (reason + reviewer columns)', async () => {
  const text = await readFile(join(SELECTION_DIR, 'aliases-overrides.csv'), 'utf8');
  assert.match(text, /reason/);
  assert.match(text, /reviewer/);
  const overrides = await loadAliasOverrides();
  assert.ok(overrides.every((o) => o.reviewer && o.reason));
});
