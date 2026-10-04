/**
 * M1-16 Favorites, recents, last qty/unit, quick-add — transaction-safe + ordering.
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

let userData;
let logFood;
let build;
let quick;
let LocalFoodRepository;
let openSeedFileViaSqlJs;

before(() => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');
  function bundle(infile, out) {
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
      ],
      { cwd: softwareRoot, stdio: 'pipe' },
    );
  }
  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(join(__dirname, '../food-detail/logFoodEntry.ts'), 'logFoodEntry.js');
  bundle(join(__dirname, '../food-detail/buildFoodDetail.ts'), 'buildFoodDetail.js');
  bundle(join(__dirname, 'quickAdd.ts'), 'quickAdd.js');
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
  if (userData) return;
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  logFood = await import(pathToFileURL(join(bundleDir, 'logFoodEntry.js')).href);
  build = await import(pathToFileURL(join(bundleDir, 'buildFoodDetail.js')).href);
  quick = await import(pathToFileURL(join(bundleDir, 'quickAdd.js')).href);
  LocalFoodRepository = (
    await import(pathToFileURL(join(bundleDir, 'LocalFoodRepository.js')).href)
  ).LocalFoodRepository;
  openSeedFileViaSqlJs = (
    await import(pathToFileURL(join(bundleDir, 'openSeedNode.js')).href)
  ).openSeedFileViaSqlJs;
}

async function openDb() {
  await loadMods();
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

async function openSeedRepo() {
  await loadMods();
  const exec = await openSeedFileViaSqlJs(fixturePath);
  return new LocalFoodRepository(exec);
}

test('favorites toggle is idempotent and orders newest-first', async () => {
  const db = await openDb();
  const a = userData.addFavorite(db, {
    foodKind: 'seed',
    foodStableId: 'food-a',
    foodDisplayName: 'A',
    foodLicenseTag: 'USDA',
  });
  // slight ordering: created_at same second — second insert is still newer in list if we bump
  const b = userData.addFavorite(db, {
    foodKind: 'seed',
    foodStableId: 'food-b',
    foodDisplayName: 'B',
    foodLicenseTag: 'USDA',
  });
  assert.equal(userData.isFavorite(db, 'seed', 'food-a'), true);
  let list = userData.listFavorites(db);
  assert.equal(list[0].foodStableId, 'food-b'); // newest first
  assert.equal(list[1].foodStableId, 'food-a');

  // toggle off then on
  const off = userData.toggleFavorite(db, {
    foodKind: 'seed',
    foodStableId: 'food-a',
    foodDisplayName: 'A',
    foodLicenseTag: 'USDA',
  });
  assert.equal(off.favorited, false);
  assert.equal(userData.isFavorite(db, 'seed', 'food-a'), false);

  const on = userData.toggleFavorite(db, {
    foodKind: 'seed',
    foodStableId: 'food-a',
    foodDisplayName: 'A',
    foodLicenseTag: 'USDA',
  });
  assert.equal(on.favorited, true);
  list = userData.listFavorites(db);
  assert.equal(list[0].foodStableId, 'food-a');

  // idempotent add
  const again = userData.addFavorite(db, {
    foodKind: 'seed',
    foodStableId: 'food-b',
    foodDisplayName: 'B2',
    foodLicenseTag: 'USDA',
  });
  assert.equal(again.id, b.id);
  assert.equal(userData.listFavorites(db).filter((f) => f.foodStableId === 'food-b').length, 1);
});

test('recents ordering + last qty/unit memory; log is transaction-safe with recent', async () => {
  const db = await openDb();
  const repo = await openSeedRepo();
  try {
    const model = build.buildSeedFoodDetail(repo, 'usda-foundation:748967');
    assert.ok(model);
    userData.ensureDefaultMealSlots(db);
    const breakfast = userData.listMealSlots(db).find((s) => s.name === 'Breakfast');

    const r1 = logFood.logFoodToDiary(db, {
      model,
      quantity: 2,
      unit: { kind: 'grams' },
      mealSlotId: breakfast?.id ?? null,
      timestamp: '2026-10-04T12:00:00.000Z',
      localDayKey: '2026-10-04',
    });
    assert.equal(r1.ok, true);

    let recents = userData.listRecentFoods(db);
    assert.equal(recents.length, 1);
    assert.equal(recents[0].foodStableId, model.foodStableId);
    assert.equal(recents[0].lastQuantity, 2);
    assert.equal(recents[0].useCount, 1);
    assert.ok(recents[0].lastUnit);

    // Second food then re-log first → first should be top again
    const custom = userData.createCustomFood(db, {
      name: 'Recent Custom',
      basisKind: 'mass',
      basisAmount: 100,
      basisUnit: 'g',
      gramWeightForBasis: 100,
      nutrients: {
        energy_kcal: 50,
        protein: 5,
        carbohydrate: 2,
        fat_total: 1,
      },
    });
    const customModel = build.buildCustomFoodDetail(custom);
    const r2 = logFood.logFoodToDiary(db, {
      model: customModel,
      quantity: 1,
      unit: { kind: 'serving', serving: customModel.servings[0] },
      mealSlotId: breakfast?.id ?? null,
      timestamp: '2026-10-04T13:00:00.000Z',
      localDayKey: '2026-10-04',
    });
    assert.equal(r2.ok, true);
    recents = userData.listRecentFoods(db);
    assert.equal(recents[0].foodStableId, custom.id);

    const r3 = logFood.logFoodToDiary(db, {
      model,
      quantity: 3,
      unit: { kind: 'grams' },
      mealSlotId: breakfast?.id ?? null,
      timestamp: '2026-10-04T14:00:00.000Z',
      localDayKey: '2026-10-04',
    });
    assert.equal(r3.ok, true);
    recents = userData.listRecentFoods(db);
    assert.equal(recents[0].foodStableId, model.foodStableId);
    assert.equal(recents[0].lastQuantity, 3);
    assert.equal(recents[0].useCount, 2);
  } finally {
    repo.close();
  }
});

test('quick-add uses remembered last qty/unit', async () => {
  const db = await openDb();
  const repo = await openSeedRepo();
  try {
    const model = build.buildSeedFoodDetail(repo, 'usda-foundation:748967');
    assert.ok(model);
    userData.ensureDefaultMealSlots(db);
    const breakfast = userData.listMealSlots(db).find((s) => s.name === 'Breakfast');

    // Seed memory
    userData.recordRecentFood(db, {
      foodKind: 'seed',
      foodStableId: model.foodStableId,
      foodDisplayName: model.displayName,
      foodLicenseTag: model.licenseTag,
      quantity: 42,
      unit: 'g',
      usedAt: '2026-10-04T10:00:00.000Z',
    });

    const qa = quick.quickAddFood(db, repo, {
      foodKind: 'seed',
      foodStableId: model.foodStableId,
      mealSlotId: breakfast?.id ?? null,
      timestamp: '2026-10-04T15:00:00.000Z',
      localDayKey: '2026-10-04',
    });
    assert.equal(qa.ok, true);
    assert.equal(qa.quantity, 42);

    const entry = userData.getDiaryEntry(db, qa.entryId);
    assert.ok(entry);
    assert.equal(entry.quantity, 42);
  } finally {
    repo.close();
  }
});
