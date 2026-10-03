/**
 * M1-11 Today diary: day keys, macro totals, slot grouping vs timestamps.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../..');
const bundleDir = join(__dirname, '.bundle');
let dayKey;
let macroTotals;
let loadToday;
let userData;

before(() => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');
  const entries = [
    ['dayKey.ts', 'dayKey.js'],
    ['macroTotals.ts', 'macroTotals.js'],
    ['loadTodayDay.ts', 'loadTodayDay.js'],
    [join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js'],
  ];
  for (const [src, out] of entries) {
    const infile = src.startsWith('/') ? src : join(__dirname, src);
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
});

async function loadMods() {
  if (dayKey) return;
  dayKey = await import(pathToFileURL(join(bundleDir, 'dayKey.js')).href);
  macroTotals = await import(pathToFileURL(join(bundleDir, 'macroTotals.js')).href);
  loadToday = await import(pathToFileURL(join(bundleDir, 'loadTodayDay.js')).href);
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
}

async function openDb() {
  await loadMods();
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

test('dayKey shift and Today/Yesterday labels', async () => {
  await loadMods();
  const today = '2026-10-03';
  assert.equal(dayKey.shiftDayKey(today, -1), '2026-10-02');
  assert.equal(dayKey.shiftDayKey(today, 1), '2026-10-04');
  assert.equal(dayKey.formatDayLabel(today, today), 'Today');
  assert.equal(dayKey.formatDayLabel('2026-10-02', today), 'Yesterday');
  assert.equal(dayKey.formatDayLabel('2026-10-04', today), 'Tomorrow');
});

test('macro totals skip null/missing; sum numerics', async () => {
  await loadMods();
  const totals = macroTotals.sumMacroTotalsFromSnapshots([
    { energy_kcal: 100, protein: 10, fat_total: null, carbohydrate: 5 },
    { energy_kcal: 50, protein: 0, carbohydrate: 10 }, // fat missing
  ]);
  assert.equal(totals.calories, 150);
  assert.equal(totals.protein, 10);
  assert.equal(totals.fat, 0);
  assert.equal(totals.carbs, 15);
});

test('empty day: four default slots, zero macros', async () => {
  const db = await openDb();
  const view = loadToday.loadTodayDay(db, '2026-10-03');
  assert.equal(view.entryCount, 0);
  assert.equal(view.slots.length, 4);
  assert.deepEqual(
    view.slots.map((s) => s.name),
    ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  );
  assert.equal(view.totals.calories, 0);
  assert.equal(view.totals.protein, 0);
  db.close();
});

test('populated day: macros reflect entries; timestamp independent of slot id', async () => {
  const db = await openDb();
  userData.ensureDefaultMealSlots(db);
  const slots = userData.listMealSlots(db);
  const breakfast = slots.find((s) => s.name === 'Breakfast');
  const dinner = slots.find((s) => s.name === 'Dinner');
  assert.ok(breakfast && dinner);

  // Breakfast slot, but late-afternoon timestamp — slot grouping must use mealSlotId.
  const lateTs = '2026-10-03T17:45:00.000Z';
  userData.createDiaryEntry(db, {
    timestamp: lateTs,
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: breakfast.id,
    foodKind: 'seed',
    foodStableId: 'food-egg',
    foodDisplayName: 'Egg',
    foodLicenseTag: 'USDA',
    quantity: 2,
    unitLabel: 'large',
    grams: 100,
    nutritionSnapshot: { energy_kcal: 140, protein: 12, fat_total: 10, carbohydrate: 1 },
    sourceDisplayName: 'USDA',
    licenseTag: 'USDA',
  });

  userData.createDiaryEntry(db, {
    timestamp: '2026-10-03T19:00:00.000Z',
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: dinner.id,
    foodKind: 'custom',
    foodStableId: randomUUID(),
    foodDisplayName: 'Yogurt',
    foodLicenseTag: 'user-custom',
    quantity: 1,
    unitLabel: 'serving',
    grams: 170,
    nutritionSnapshot: { energy_kcal: 130, protein: 17, fat_total: 0, carbohydrate: 14 },
    sourceDisplayName: 'Custom',
    licenseTag: 'user-custom',
  });

  // Unscheduled entry (null slot)
  userData.createDiaryEntry(db, {
    timestamp: '2026-10-03T10:00:00.000Z',
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: null,
    foodKind: 'seed',
    foodStableId: 'food-apple',
    foodDisplayName: 'Apple',
    foodLicenseTag: 'USDA',
    quantity: 1,
    unitLabel: 'medium',
    grams: 180,
    nutritionSnapshot: { energy_kcal: 95, protein: 0.5, fat_total: 0.3, carbohydrate: 25 },
    sourceDisplayName: 'USDA',
    licenseTag: 'USDA',
  });

  const view = loadToday.loadTodayDay(db, '2026-10-03');
  assert.equal(view.entryCount, 3);
  assert.equal(view.totals.calories, 365); // 140+130+95
  assert.equal(view.totals.protein, 29.5);

  const bSlot = view.slots.find((s) => s.name === 'Breakfast');
  assert.equal(bSlot.entries.length, 1);
  assert.equal(bSlot.entries[0].foodDisplayName, 'Egg');
  assert.equal(bSlot.entries[0].timestamp, lateTs);
  assert.equal(bSlot.entries[0].mealSlotId, breakfast.id);

  const dSlot = view.slots.find((s) => s.name === 'Dinner');
  assert.equal(dSlot.entries.length, 1);
  assert.equal(dSlot.entries[0].foodDisplayName, 'Yogurt');

  assert.equal(view.unscheduled.length, 1);
  assert.equal(view.unscheduled[0].foodDisplayName, 'Apple');
  assert.equal(view.unscheduled[0].mealSlotId, null);

  // Empty other day
  const empty = loadToday.loadTodayDay(db, '2026-10-02');
  assert.equal(empty.entryCount, 0);
  assert.equal(empty.totals.calories, 0);

  db.close();
});


test('archived meal slot entries land in Unscheduled (not dropped)', async () => {
  const db = await openDb();
  userData.ensureDefaultMealSlots(db);
  const breakfast = userData.listMealSlots(db).find((s) => s.name === 'Breakfast');
  assert.ok(breakfast);
  userData.createDiaryEntry(db, {
    timestamp: '2026-10-03T12:00:00.000Z',
    localDayKey: '2026-10-03',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: breakfast.id,
    foodKind: 'seed',
    foodStableId: 'food-x',
    foodDisplayName: 'Archived-slot food',
    foodLicenseTag: 'USDA',
    quantity: 1,
    unitLabel: 'serving',
    grams: 50,
    nutritionSnapshot: { energy_kcal: 40, protein: 1, fat_total: 0, carbohydrate: 8 },
    sourceDisplayName: 'USDA',
    licenseTag: 'USDA',
  });
  db.run('UPDATE meal_slot SET is_archived = 1 WHERE id = ?', [breakfast.id]);
  const view = loadToday.loadTodayDay(db, '2026-10-03');
  assert.equal(view.entryCount, 1);
  assert.equal(view.totals.calories, 40);
  assert.ok(!view.slots.some((s) => s.name === 'Breakfast'));
  assert.equal(view.unscheduled.length, 1);
  assert.equal(view.unscheduled[0].foodDisplayName, 'Archived-slot food');
  assert.equal(view.unscheduled[0].mealSlotId, breakfast.id);
  db.close();
});

test('Today screen + smoke paths exist', () => {
  assert.ok(readFileSync(join(softwareRoot, 'app/(tabs)/today.tsx'), 'utf8').includes('loadTodayDay'));
  assert.ok(readFileSync(join(softwareRoot, 'modules/diary/loadTodayDay.ts'), 'utf8').length > 50);
  assert.ok(
    readFileSync(join(softwareRoot, '../docs/demo/smoke-m1-11-today.sh'), 'utf8').includes('smoke-m1-11'),
  );
});
