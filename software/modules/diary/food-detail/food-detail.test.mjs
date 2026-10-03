/**
 * M1-13 Food detail/log sheet — golden calc, validation, atomic Today update.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const bundleDir = join(__dirname, '.bundle');
const fixturePath = join(
  softwareRoot,
  'modules/food-catalog/assets/FoodSeed.fixture.sqlite',
);

let parseQty;
let scale;
let resolve;
let compute;
let build;
let logFood;
let loadToday;
let userData;
let LocalFoodRepository;
let openSeedFileViaSqlJs;

before(() => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');
  function bundle(infile, out, extraExternal = []) {
    execFileSync(
      esbuildBin,
      [
        infile,
        '--bundle',
        '--platform=node',
        '--format=esm',
        `--outfile=${join(bundleDir, out)}`,
        '--external:sql.js',
        '--external:expo-sqlite',
        '--external:react',
        '--external:react-native',
        '--external:node-sqlite3-wasm',
        ...extraExternal.map((e) => `--external:${e}`),
      ],
      { cwd: softwareRoot, stdio: 'pipe' },
    );
  }
  for (const name of [
    'parseQuantity',
    'scaleNutrients',
    'resolveAmount',
    'computeLiveNutrients',
    'buildFoodDetail',
    'logFoodEntry',
  ]) {
    bundle(join(__dirname, `${name}.ts`), `${name}.js`);
  }
  bundle(join(__dirname, '../loadTodayDay.ts'), 'loadTodayDay.js');
  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(
    join(softwareRoot, 'modules/food-catalog/local-food-repo/LocalFoodRepository.ts'),
    'LocalFoodRepository.js',
  );
  bundle(
    join(softwareRoot, 'modules/food-catalog/local-food-repo/openSeedNode.ts'),
    'openSeedNode.js',
  );
});

async function loadMods() {
  if (parseQty) return;
  parseQty = await import(pathToFileURL(join(bundleDir, 'parseQuantity.js')).href);
  scale = await import(pathToFileURL(join(bundleDir, 'scaleNutrients.js')).href);
  resolve = await import(pathToFileURL(join(bundleDir, 'resolveAmount.js')).href);
  compute = await import(pathToFileURL(join(bundleDir, 'computeLiveNutrients.js')).href);
  build = await import(pathToFileURL(join(bundleDir, 'buildFoodDetail.js')).href);
  logFood = await import(pathToFileURL(join(bundleDir, 'logFoodEntry.js')).href);
  loadToday = await import(pathToFileURL(join(bundleDir, 'loadTodayDay.js')).href);
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  LocalFoodRepository = (
    await import(pathToFileURL(join(bundleDir, 'LocalFoodRepository.js')).href)
  ).LocalFoodRepository;
  ({ openSeedFileViaSqlJs } = await import(
    pathToFileURL(join(bundleDir, 'openSeedNode.js')).href
  ));
}

async function openUserDb() {
  await loadMods();
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

async function openSeedRepo() {
  // sql.js in-memory copy — avoids file locks when npm test runs suites in parallel.
  const db = await openSeedFileViaSqlJs(fixturePath);
  return new LocalFoodRepository(db);
}

test('parseQuantity: rejects empty, invalid, zero, negative; accepts decimals', async () => {
  await loadMods();
  assert.equal(parseQty.parseQuantityInput('').ok, false);
  assert.equal(parseQty.parseQuantityInput('  ').ok, false);
  assert.equal(parseQty.parseQuantityInput('abc').ok, false);
  assert.equal(parseQty.parseQuantityInput('1e3').ok, false);
  assert.equal(parseQty.parseQuantityInput('0').ok, false);
  assert.equal(parseQty.parseQuantityInput('-2').reason, 'non_positive');
  assert.equal(parseQty.parseQuantityInput('-0.5').reason, 'non_positive');
  const ok = parseQty.parseQuantityInput('1.5');
  assert.equal(ok.ok, true);
  assert.equal(ok.value, 1.5);
  const ok2 = parseQty.parseQuantityInput('.25');
  assert.equal(ok2.ok, true);
  assert.equal(ok2.value, 0.25);
});

test('golden: egg 1 serving (50.3 g) scales per-100 g macros', async () => {
  await loadMods();
  // Fixture: energy 148, protein 12.4, fat 9.96, carb 0.96 per 100 g; 1 egg = 50.3 g
  const per100 = {
    energy_kcal: 148,
    protein: 12.4,
    fat_total: 9.96,
    carbohydrate: 0.96,
    fiber: 0,
    sodium: 129,
    cholesterol: 411,
    mystery_missing: null,
  };
  const grams = 50.3;
  const snap = scale.scaleNutrientsPer100g(per100, grams);
  assert.equal(snap.energy_kcal, 74.4); // 148 * 0.503 → 74.444 → 74.4
  assert.equal(snap.protein, 6.24); // 12.4 * 0.503
  assert.equal(snap.fat_total, 5.01); // 9.96 * 0.503 = 5.00988 → 5.01
  assert.equal(snap.carbohydrate, 0.48); // 0.96 * 0.503 = 0.48288 → 0.48
  assert.equal(snap.fiber, 0);
  assert.equal(snap.sodium, 64.9); // 129 * 0.503 = 64.887 → 64.9
  assert.equal(snap.cholesterol, 206.7);
  assert.equal(snap.mystery_missing, null);
  assert.equal(Object.prototype.hasOwnProperty.call(snap, 'absent'), false);
});

test('golden: 100 g identity; 2.5 servings of 28.35 g almond oz', async () => {
  await loadMods();
  const per100 = { energy_kcal: 579, protein: 21.15, fat_total: 49.93, carbohydrate: 21.55 };
  const identity = scale.scaleNutrientsPer100g(per100, 100);
  assert.equal(identity.energy_kcal, 579);
  assert.equal(identity.protein, 21.15);

  const resolved = resolve.resolveSeedAmount(2.5, {
    kind: 'serving',
    serving: { servingId: 1, quantity: 1, unit: 'oz', gramWeight: 28.35 },
  });
  assert.equal(resolved.grams, 2.5 * 28.35);
  const snap = scale.scaleNutrientsPer100g(per100, resolved.grams);
  // 70.875 g → factor 0.70875; 579 * 0.70875 = 410.36625 → 410.4
  assert.equal(snap.energy_kcal, 410.4);
  assert.equal(snap.protein, 14.99); // 21.15 * 0.70875 = 14.9900625 → 14.99
});

test('golden: custom basis factor scales; missing stays missing', async () => {
  await loadMods();
  const basis = {
    energy_kcal: 200,
    protein: 10,
    fat_total: null,
    carbohydrate: 20,
  };
  // Log 1.5 × a 100 g / 100 g basis → factor 1.5 when grams mode with gramWeight 100 basisAmount 100
  const snap = scale.scaleNutrientsByFactor(basis, 1.5);
  assert.equal(snap.energy_kcal, 300);
  assert.equal(snap.protein, 15);
  assert.equal(snap.fat_total, null);
  assert.equal(snap.carbohydrate, 30);
});

test('resolveSeedAmount: grams and serving; rejects bad qty', async () => {
  await loadMods();
  assert.equal(resolve.resolveSeedAmount(40, { kind: 'grams' }).grams, 40);
  assert.equal(resolve.resolveSeedAmount(40, { kind: 'grams' }).unitLabel, 'g');
  const s = resolve.resolveSeedAmount(2, {
    kind: 'serving',
    serving: {
      servingId: 1,
      quantity: 1,
      unit: 'egg',
      modifier: 'whole without shell',
      gramWeight: 50.3,
    },
  });
  assert.equal(s.grams, 100.6);
  assert.match(s.unitLabel, /egg/);
  assert.throws(() => resolve.resolveSeedAmount(-1, { kind: 'grams' }));
});

test('computeLiveNutrients + buildSeedFoodDetail against fixture egg', async () => {
  await loadMods();
  const repo = await openSeedRepo();
  try {
    const model = build.buildSeedFoodDetail(repo, 'usda-foundation:748967');
    assert.ok(model);
    assert.equal(model.kind, 'seed');
    assert.ok(model.servings.length >= 1);
    const serving = model.servings[0];
    const live = compute.computeLiveNutrients(model, 1, { kind: 'serving', serving });
    assert.equal(live.ok, true);
    assert.equal(live.grams, 50.3);
    assert.equal(live.nutritionSnapshot.energy_kcal, 74.4);
    assert.equal(live.nutritionSnapshot.protein, 6.24);

    const bad = compute.computeLiveNutrients(model, -3, { kind: 'grams' });
    assert.equal(bad.ok, false);

    const gramsLive = compute.computeLiveNutrients(model, 100, { kind: 'grams' });
    assert.equal(gramsLive.ok, true);
    assert.equal(gramsLive.nutritionSnapshot.energy_kcal, 148);
  } finally {
    repo.close();
  }
});

test('invalid/negative quantity blocked at logFoodToDiary', async () => {
  const db = await openUserDb();
  const repo = await openSeedRepo();
  try {
    const model = build.buildSeedFoodDetail(repo, 'usda-foundation:748967');
    const serving = model.servings[0];
    const blocked = logFood.logFoodToDiary(db, {
      model,
      quantity: -1,
      unit: { kind: 'serving', serving },
      mealSlotId: null,
      localDayKey: '2026-10-03',
    });
    assert.equal(blocked.ok, false);
    const zero = logFood.logFoodToDiary(db, {
      model,
      quantity: 0,
      unit: { kind: 'grams' },
      mealSlotId: null,
      localDayKey: '2026-10-03',
    });
    assert.equal(zero.ok, false);
    assert.equal(userData.listDiaryEntriesForDay(db, '2026-10-03').length, 0);
  } finally {
    repo.close();
    db.close();
  }
});

test('Today updates atomically on log (entry + macros visible after commit)', async () => {
  const db = await openUserDb();
  const repo = await openSeedRepo();
  try {
  userData.ensureDefaultMealSlots(db);
  const slots = userData.listMealSlots(db);
  const breakfast = slots.find((s) => s.name === 'Breakfast');
  assert.ok(breakfast);

  const before = loadToday.loadTodayDay(db, '2026-10-03');
  assert.equal(before.entryCount, 0);

  const model = build.buildSeedFoodDetail(repo, 'usda-foundation:748967');
  const serving = model.servings[0];
  const result = logFood.logFoodToDiary(db, {
    model,
    quantity: 2,
    unit: { kind: 'serving', serving },
    mealSlotId: breakfast.id,
    timestamp: '2026-10-03T15:00:00.000Z',
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
  });
  assert.equal(result.ok, true);
  assert.equal(result.entry.mealSlotId, breakfast.id);
  assert.equal(result.entry.grams, 100.6);
  // 2 eggs: 148 * 1.006 = 148.888 → 148.9
  assert.equal(result.entry.nutritionSnapshot.energy_kcal, 148.9);

  const after = loadToday.loadTodayDay(db, '2026-10-03');
  assert.equal(after.entryCount, 1);
  assert.equal(after.slots.find((s) => s.name === 'Breakfast').entries.length, 1);
  assert.equal(after.totals.calories, 149); // MacroSummary rounds kcal
  assert.ok(after.totals.protein > 0);

  // Custom food path
  const custom = userData.createCustomFood(db, {
    name: 'Test Shake',
    basisKind: 'serving',
    basisAmount: 1,
    basisUnit: 'bottle',
    gramWeightForBasis: 250,
    nutrients: {
      energy_kcal: 180,
      protein: 25,
      fat_total: 3,
      carbohydrate: 10,
      fiber: null,
    },
  });
  const customModel = build.buildCustomFoodDetail(custom);
  const customLog = logFood.logFoodToDiary(db, {
    model: customModel,
    quantity: 1,
    unit: { kind: 'serving', serving: customModel.servings[0] },
    mealSlotId: breakfast.id,
    timestamp: '2026-10-03T16:00:00.000Z',
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
  });
  assert.equal(customLog.ok, true);
  assert.equal(customLog.entry.nutritionSnapshot.energy_kcal, 180);
  assert.equal(customLog.entry.nutritionSnapshot.fiber, null);

  const after2 = loadToday.loadTodayDay(db, '2026-10-03');
  assert.equal(after2.entryCount, 2);
  assert.equal(after2.totals.calories, 149 + 180);
  } finally {
    repo.close();
    db.close();
  }
});
