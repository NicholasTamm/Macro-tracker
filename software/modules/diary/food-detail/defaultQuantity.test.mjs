/** Issue #138: metric defaults use 100 g; source portions and history stay distinct. */
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const softwareRoot = fileURLToPath(new URL('../../../', import.meta.url));
const outfile = join(dirname(fileURLToPath(import.meta.url)), '.bundle/issue-138/defaults.mjs');
let api;
let repo;

before(async () => {
  mkdirSync(dirname(outfile), { recursive: true });
  await build({
    stdin: {
      contents: `
        export * from './modules/diary/food-detail/buildFoodDetail';
        export * from './modules/diary/food-detail/computeLiveNutrients';
        export * from './modules/diary/favorites-recents/quickAdd';
        export * from './modules/app-core/user-data';
        export * from './modules/food-catalog/local-food-repo/LocalFoodRepository';
        export * from './modules/food-catalog/local-food-repo/openSeedNode';
      `,
      resolveDir: softwareRoot,
    },
    bundle: true, platform: 'node', format: 'esm',
    external: ['sql.js', 'expo-sqlite', 'react', 'react-native', 'node-sqlite3-wasm'],
    outfile,
  });
  api = await import(pathToFileURL(outfile).href);
  repo = new api.LocalFoodRepository(await api.openSeedFileViaSqlJs(
    join(softwareRoot, 'modules/food-catalog/assets/FoodSeed.fixture.sqlite'),
  ));
});
after(() => repo?.close());

const foods = [
  ['roasted chicken breast', 'usda-sr-legacy:171079', 28.35],
  ['egg', 'usda-foundation:748967', 50.3],
  ['cooked brown rice', 'usda-sr-legacy:168878', 195],
  ['banana', 'usda-sr-legacy:173944', 225],
];

for (const [name, id, portionGrams] of foods) {
  test(`${name}: metric opens at 100 g, imperial retains its source serving`, () => {
    const metric = api.buildSeedFoodDetail(repo, id, 'kg');
    const imperial = api.buildSeedFoodDetail(repo, id, 'lb');
    assert.deepEqual(metric.defaultUnit, { kind: 'grams' });
    assert.equal(metric.suggestedQuantity, 100);
    assert.equal(imperial.defaultUnit.kind, 'serving');
    assert.equal(imperial.suggestedQuantity, 1);
    const serving = imperial.servings.find(s => s.servingId === imperial.defaultUnit.servingId);
    assert.equal(serving.gramWeight, portionGrams);
    const preview = api.computeLiveNutrients(metric, metric.suggestedQuantity, { kind: 'grams' });
    assert.equal(preview.ok, true);
    assert.equal(preview.grams, 100);
    assert.equal(preview.nutritionSnapshot.energy_kcal, metric.nutrients.energy_kcal);
  });
}

test('metric seed without a portion still defaults to 100 g', () => {
  const withoutPortions = Object.create(repo);
  withoutPortions.getServings = () => [];
  const model = api.buildSeedFoodDetail(withoutPortions, foods[0][1], 'kg');
  assert.deepEqual(model.defaultUnit, { kind: 'grams' });
  assert.equal(model.suggestedQuantity, 100);
});

test('custom metric foods use 100 g when weighable and retain servings otherwise', async () => {
  const db = await api.openSqlJsDatabase();
  try {
    api.migrateUserStore(db);
    for (const gramWeightForBasis of [250, null]) {
      const food = api.createCustomFood(db, {
        name: 'Shake', basisKind: 'serving', basisAmount: 1, basisUnit: 'bottle',
        gramWeightForBasis, nutrients: { energy_kcal: 180, protein: 25, fat_total: 3, carbohydrate: 10 },
      });
      const model = api.buildCustomFoodDetail(food, 'kg');
      assert.deepEqual(model.defaultUnit, gramWeightForBasis
        ? { kind: 'grams' } : { kind: 'serving', servingId: 0 });
      assert.equal(model.suggestedQuantity, gramWeightForBasis ? 100 : 1);
    }
  } finally {
    db.close();
  }
});

for (const rememberedUnit of [null, 'g', 'oz']) {
  test(`metric favorite quick-add: ${rememberedUnit ?? 'no history'} uses the correct quantity and unit`, async () => {
    const db = await api.openSqlJsDatabase();
    try {
      api.migrateUserStore(db);
      const model = api.buildSeedFoodDetail(repo, foods[0][1], 'kg');
      const identity = {
        foodKind: 'seed', foodStableId: model.foodStableId,
        foodDisplayName: model.displayName, foodLicenseTag: model.licenseTag,
      };
      api.addFavorite(db, identity);
      if (rememberedUnit) {
        api.recordRecentFood(db, { ...identity, quantity: 2.5, unit: rememberedUnit });
      }
      const result = api.quickAddFood(db, repo, { ...identity, mealSlotId: null, massUnit: 'kg' });
      assert.equal(result.ok, true);
      assert.equal(result.quantity, rememberedUnit ? 2.5 : 100);
      assert.equal(result.unitLabel, rememberedUnit ?? 'g');
      const entry = api.getDiaryEntry(db, result.entryId);
      assert.equal(entry.grams, rememberedUnit === 'oz' ? 2.5 * 28.35 : rememberedUnit ? 2.5 : 100);
    } finally {
      db.close();
    }
  });
}
