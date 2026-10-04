/**
 * M1-19 CSV+JSON export — round-trip fixture, provenance, share path docs.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../..');
// __dirname is .../modules/app-core/export → softwareRoot = modules? Fix:
const softwareRootFixed = join(__dirname, '../../..');
const bundleDir = join(__dirname, '.bundle');

let userData;
let exp;

before(() => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const esbuildBin = join(softwareRootFixed, 'node_modules/esbuild/bin/esbuild');
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
      { cwd: softwareRootFixed, stdio: 'pipe' },
    );
  }
  bundle(join(softwareRootFixed, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(join(__dirname, 'index.ts'), 'export.js');
});

async function loadMods() {
  if (userData) return;
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  exp = await import(pathToFileURL(join(bundleDir, 'export.js')).href);
}

async function openDb() {
  await loadMods();
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

async function seedFixture(db) {
  userData.ensureProfile(db);
  userData.updateProfile(db, {
    isAdultConfirmed: true,
    massUnit: 'kg',
    heightUnit: 'cm',
    energyUnit: 'kcal',
    sex: 'male',
    birthYear: 1995,
    heightCm: 180,
    weightKg: 80,
  });
  userData.setActiveGoal(db, 'maintain', null);
  userData.saveStarterTarget(db, {
    energyKcal: 2500,
    proteinG: 150,
    carbohydrateG: 250,
    fatG: 80,
  });
  userData.ensureDefaultMealSlots(db);
  const slots = userData.listMealSlots(db);
  userData.createDiaryEntry(db, {
    timestamp: '2026-10-04T15:00:00.000Z',
    localDayKey: '2026-10-04',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: slots[0]?.id ?? null,
    foodKind: 'seed',
    foodStableId: 'usda-foundation:748967',
    foodDisplayName: 'Egg',
    foodLicenseTag: 'USDA',
    quantity: 2,
    unitLabel: 'large',
    grams: 100,
    nutritionSnapshot: {
      energy_kcal: 143,
      protein: 12.6,
      fat_total: 9.5,
      carbohydrate: 0.7,
    },
    sourceDisplayName: 'USDA FoodData Central',
    licenseTag: 'USDA',
  });
  userData.createWeightSample(db, {
    timestamp: '2026-10-04T08:00:00.000Z',
    kilograms: 80.2,
    source: 'manual',
  });
  userData.createCustomFood(db, {
    name: 'Export Yogurt',
    basisKind: 'mass',
    basisAmount: 170,
    basisUnit: 'g',
    gramWeightForBasis: 170,
    nutrients: {
      energy_kcal: 130,
      protein: 17,
      fat_total: 0,
      carbohydrate: 14,
    },
  });
}

test('JSON+CSV export includes profile, diary snapshots, weights, targets, provenance', async () => {
  const db = await openDb();
  await seedFixture(db);
  const exportedAt = '2026-10-04T12:00:00.000Z';
  const files = exp.buildUserDataExportFiles(db, { exportedAt });
  assert.match(files.suggestedJsonName, /macro-tracker-export/);
  assert.match(files.suggestedCsvName, /\.csv$/);

  const payload = exp.parseExportJson(files.json);
  assert.equal(payload.provenance.formatVersion, 1);
  assert.equal(payload.provenance.exportedAt, exportedAt);
  assert.ok(payload.provenance.note.toLowerCase().includes('foodseed') || payload.provenance.note.includes('FoodSeed'));
  assert.ok(payload.profile);
  assert.equal(payload.profile.birthYear, 1995);
  assert.ok(payload.targets.length >= 1);
  assert.equal(payload.diaryEntries.length, 1);
  assert.equal(payload.diaryEntries[0].nutritionSnapshot.energy_kcal, 143);
  assert.equal(payload.diaryEntries[0].licenseTag, 'USDA');
  assert.equal(payload.weights.length, 1);
  assert.equal(payload.weights[0].kilograms, 80.2);
  assert.ok(payload.customFoods.some((f) => f.name === 'Export Yogurt'));

  assert.match(files.csv, /# section:provenance/);
  assert.match(files.csv, /# section:diary_entries/);
  assert.match(files.csv, /nutrition_snapshot_json/);
  assert.match(files.csv, /# section:weights/);
  assert.match(files.csv, /80\.2/);
  assert.match(files.csv, /# section:targets/);
});

test('JSON round-trip fixture preserves diary snapshot + provenance', async () => {
  const db = await openDb();
  await seedFixture(db);
  const files = exp.buildUserDataExportFiles(db, {
    exportedAt: '2026-10-04T13:00:00.000Z',
  });
  const again = exp.parseExportJson(files.json);
  const reJson = exp.exportToJsonString(again);
  const third = exp.parseExportJson(reJson);
  assert.deepEqual(third.diaryEntries, again.diaryEntries);
  assert.deepEqual(third.weights, again.weights);
  assert.deepEqual(third.targets, again.targets);
  assert.equal(third.provenance.formatVersion, 1);
});

test('share path module documents Expo file URI option + exports share helper', async () => {
  await loadMods();
  assert.equal(typeof exp.shareExportViaPlatform, 'function');
  assert.match(exp.EXPO_FILE_SHARE_PATH_DOC, /expo-sharing/i);
  const readme = readFileSync(join(__dirname, 'README.md'), 'utf8');
  assert.match(readme, /Share/);
});

test('export does not include remote_food_cache / FoodSeed tables', async () => {
  const db = await openDb();
  await seedFixture(db);
  // Insert a cache row to ensure we still don't export it
  db.run(
    `INSERT INTO remote_food_cache (
      cache_key, provider, external_id, gtin14, response_json, fetched_at, expires_at,
      persistence_policy, terms_version, etag, last_accessed_at
    ) VALUES ('k','off','1',NULL,NULL,?,?, 'expires', NULL, NULL, ?)`,
    ['2026-10-04T00:00:00.000Z', '2026-10-05T00:00:00.000Z', '2026-10-04T00:00:00.000Z'],
  );
  const files = exp.buildUserDataExportFiles(db, { exportedAt: '2026-10-04T14:00:00.000Z' });
  assert.doesNotMatch(files.json, /remote_food_cache/);
  assert.doesNotMatch(files.json, /"cache_key"/);
});
