/**
 * M1-14 Diary edit/delete/undo + immutable nutrition snapshots.
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

let scaleSnap;
let editQty;
let deleteUndo;
let userData;
let loadToday;

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
      ],
      { cwd: softwareRoot, stdio: 'pipe' },
    );
  }
  bundle(join(__dirname, 'scaleSnapshotForQuantity.ts'), 'scaleSnapshotForQuantity.js');
  bundle(join(__dirname, 'editDiaryQuantity.ts'), 'editDiaryQuantity.js');
  bundle(join(__dirname, 'deleteAndUndo.ts'), 'deleteAndUndo.js');
  bundle(join(__dirname, '../loadTodayDay.ts'), 'loadTodayDay.js');
  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
});

async function loadMods() {
  if (scaleSnap) return;
  scaleSnap = await import(
    pathToFileURL(join(bundleDir, 'scaleSnapshotForQuantity.js')).href
  );
  editQty = await import(pathToFileURL(join(bundleDir, 'editDiaryQuantity.js')).href);
  deleteUndo = await import(pathToFileURL(join(bundleDir, 'deleteAndUndo.js')).href);
  loadToday = await import(pathToFileURL(join(bundleDir, 'loadTodayDay.js')).href);
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
}

async function openDb() {
  await loadMods();
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

function seedEntry(db, overrides = {}) {
  return userData.createDiaryEntry(db, {
    timestamp: '2026-10-03T15:00:00.000Z',
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: null,
    foodKind: 'seed',
    foodStableId: 'usda-foundation:748967',
    foodDisplayName: 'Egg',
    foodLicenseTag: 'USDA',
    quantity: 2,
    unitLabel: 'egg',
    grams: 100.6,
    nutritionSnapshot: {
      energy_kcal: 148.9,
      protein: 12.48,
      fat_total: 10.02,
      carbohydrate: 0.96,
      fiber: null,
    },
    sourceDisplayName: 'USDA Foundation',
    licenseTag: 'USDA',
    ...overrides,
  });
}

test('scaleSnapshotForQuantity halves macros and grams; null stays null', async () => {
  await loadMods();
  const scaled = scaleSnap.scaleSnapshotForQuantity(
    {
      quantity: 2,
      grams: 100.6,
      nutritionSnapshot: {
        energy_kcal: 148.9,
        protein: 12.48,
        fat_total: 10.02,
        carbohydrate: 0.96,
        fiber: null,
      },
    },
    1,
  );
  assert.equal(scaled.quantity, 1);
  assert.equal(scaled.factor, 0.5);
  assert.equal(scaled.grams, 50.3);
  assert.equal(scaled.nutritionSnapshot.energy_kcal, 74.5); // 148.9 * 0.5 → 74.45 → 74.5 (1dp)
  assert.equal(scaled.nutritionSnapshot.protein, 6.24);
  assert.equal(scaled.nutritionSnapshot.fiber, null);
});

test('edit qty recalculates from snapshot; Today macros update', async () => {
  const db = await openDb();
  try {
    const entry = seedEntry(db);
    const edited = editQty.editDiaryEntryQuantity(db, entry.id, 1);
    assert.equal(edited.ok, true);
    assert.equal(edited.entry.quantity, 1);
    assert.equal(edited.entry.grams, 50.3);
    assert.equal(edited.previous.quantity, 2);
    assert.equal(edited.previous.nutritionSnapshot.energy_kcal, 148.9);
    assert.equal(edited.entry.nutritionSnapshot.energy_kcal, 74.5);

    const day = loadToday.loadTodayDay(db, '2026-10-03');
    assert.equal(day.entryCount, 1);
    assert.equal(day.totals.calories, 75); // rounded
  } finally {
    db.close();
  }
});

test('delete + undo restores entry; edit undo restores prior snapshot', async () => {
  const db = await openDb();
  try {
    const entry = seedEntry(db);
    const del = deleteUndo.deleteDiaryEntry(db, entry.id);
    assert.equal(del.ok, true);
    assert.equal(loadToday.loadTodayDay(db, '2026-10-03').entryCount, 0);

    const undel = deleteUndo.applyDiaryUndo(db, del.undo);
    assert.equal(undel.ok, true);
    assert.equal(loadToday.loadTodayDay(db, '2026-10-03').entryCount, 1);
    assert.equal(undel.entry.quantity, 2);

    const edited = editQty.editDiaryEntryQuantity(db, entry.id, 4);
    assert.equal(edited.ok, true);
    assert.equal(edited.entry.quantity, 4);
    // 2× original macros
    assert.equal(edited.entry.nutritionSnapshot.energy_kcal, 297.8);

    const undoEdit = deleteUndo.applyDiaryUndo(db, {
      kind: 'edit',
      entryId: entry.id,
      foodDisplayName: entry.foodDisplayName,
      previous: edited.previous,
    });
    assert.equal(undoEdit.ok, true);
    assert.equal(undoEdit.entry.quantity, 2);
    assert.equal(undoEdit.entry.nutritionSnapshot.energy_kcal, 148.9);
  } finally {
    db.close();
  }
});

test('custom food nutrient update cannot rewrite historical diary snapshot; edit scales frozen snap', async () => {
  const db = await openDb();
  try {
    const custom = userData.createCustomFood(db, {
      name: 'Shake',
      basisKind: 'serving',
      basisAmount: 1,
      basisUnit: 'bottle',
      gramWeightForBasis: 250,
      nutrients: {
        energy_kcal: 180,
        protein: 25,
        fat_total: 3,
        carbohydrate: 10,
      },
    });
    const entry = userData.createDiaryEntry(db, {
      timestamp: '2026-10-03T16:00:00.000Z',
      localDayKey: '2026-10-03',
      timezoneIdentifier: 'America/Vancouver',
      mealSlotId: null,
      foodKind: 'custom',
      foodStableId: custom.id,
      foodDisplayName: custom.name,
      foodLicenseTag: 'user-custom',
      quantity: 1,
      unitLabel: 'bottle',
      grams: 250,
      nutritionSnapshot: {
        energy_kcal: 180,
        protein: 25,
        fat_total: 3,
        carbohydrate: 10,
      },
      sourceDisplayName: 'My Foods',
      licenseTag: 'user-custom',
    });

    // Mutate custom food definition — diary row must stay 180.
    userData.updateCustomFoodNutrients(db, custom.id, {
      energy_kcal: 999,
      protein: 1,
      fat_total: 1,
      carbohydrate: 1,
    });
    const afterCustomEdit = userData.getDiaryEntry(db, entry.id);
    assert.equal(afterCustomEdit.nutritionSnapshot.energy_kcal, 180);

    // Qty edit scales the frozen snapshot, not the updated custom nutrients.
    const edited = editQty.editDiaryEntryQuantity(db, entry.id, 2);
    assert.equal(edited.ok, true);
    assert.equal(edited.entry.nutritionSnapshot.energy_kcal, 360);
    assert.notEqual(edited.entry.nutritionSnapshot.energy_kcal, 999 * 2);
  } finally {
    db.close();
  }
});

test('invalid/zero qty edit blocked', async () => {
  const db = await openDb();
  try {
    const entry = seedEntry(db);
    assert.equal(editQty.editDiaryEntryQuantity(db, entry.id, 0).ok, false);
    assert.equal(editQty.editDiaryEntryQuantity(db, entry.id, -1).ok, false);
    const still = userData.getDiaryEntry(db, entry.id);
    assert.equal(still.quantity, 2);
  } finally {
    db.close();
  }
});
