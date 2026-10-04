/**
 * M1-15 Custom-food create/edit/archive — barcode, missing≠zero, snapshot immutability.
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

let userData;
let validateDraft;
let saveCustom;

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
  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(join(__dirname, 'validateDraft.ts'), 'validateDraft.js');
  bundle(join(__dirname, 'saveCustomFood.ts'), 'saveCustomFood.js');
});

async function loadMods() {
  if (userData) return;
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  validateDraft = await import(pathToFileURL(join(bundleDir, 'validateDraft.js')).href);
  saveCustom = await import(pathToFileURL(join(bundleDir, 'saveCustomFood.js')).href);
}

async function openDb() {
  await loadMods();
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

/** Known-valid UPC-A → GTIN-14 */
const VALID_UPC = '036000291452';
const VALID_GTIN14 = '00036000291452';

function baseDraft(overrides = {}) {
  return {
    name: 'Greek Yogurt',
    brand: 'Homemade',
    barcodeRaw: '',
    basisKind: 'mass',
    basisAmountText: '170',
    basisUnit: 'g',
    gramWeightText: '170',
    energyKcalText: '130',
    proteinText: '17',
    carbohydrateText: '14',
    fatTotalText: '0',
    optionalNutrients: { fiber: '', sodium: '50', sugar: '' },
    ...overrides,
  };
}

test('GTIN check digit: valid UPC normalizes to GTIN-14', async () => {
  await loadMods();
  const r = userData.validateAndNormalizeBarcode(VALID_UPC);
  assert.equal(r.ok, true);
  assert.equal(r.gtin14, VALID_GTIN14);
  assert.equal(userData.isValidGtin14(VALID_GTIN14), true);
});

test('invalid check digit rejected', async () => {
  await loadMods();
  const bad = userData.validateAndNormalizeBarcode('036000291453');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /check digit/i);
});

test('empty barcode allowed (null)', async () => {
  await loadMods();
  const r = userData.validateAndNormalizeBarcode('  ');
  assert.equal(r.ok, true);
  assert.equal(r.gtin14, null);
});

test('create/edit/archive + missing≠zero + diary snapshot immutable', async () => {
  const db = await openDb();

  const created = saveCustom.saveCustomFoodCreate(db, baseDraft({
    barcodeRaw: VALID_UPC,
    optionalNutrients: { fiber: '', sodium: '50', sugar: '0' },
  }));
  assert.equal(created.ok, true);
  const food = created.food;
  assert.equal(food.barcodeGtin14, VALID_GTIN14);
  assert.equal(food.nutrients.fat_total, 0);
  assert.equal(userData.isExplicitZero(food.nutrients, 'fat_total'), true);
  assert.equal(userData.isMissing(food.nutrients, 'fiber'), true);
  assert.equal(food.nutrients.sodium, 50);
  assert.equal(userData.isExplicitZero(food.nutrients, 'sugar'), true);

  // Log diary entry with snapshot of current macros
  const entry = userData.createDiaryEntry(db, {
    timestamp: '2026-10-04T12:00:00.000Z',
    localDayKey: '2026-10-04',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: null,
    foodKind: 'custom',
    foodStableId: food.id,
    foodDisplayName: food.name,
    foodLicenseTag: 'user-custom',
    quantity: 1,
    unitLabel: 'serving',
    grams: 170,
    nutritionSnapshot: {
      energy_kcal: 130,
      protein: 17,
      carbohydrate: 14,
      fat_total: 0,
    },
    sourceDisplayName: 'Custom',
    licenseTag: 'user-custom',
  });

  // Edit macros upward — diary snapshot must stay 130
  const edited = saveCustom.saveCustomFoodEdit(db, food.id, baseDraft({
    name: 'Greek Yogurt',
    energyKcalText: '200',
    proteinText: '20',
    carbohydrateText: '10',
    fatTotalText: '2',
    barcodeRaw: VALID_UPC,
  }));
  assert.equal(edited.ok, true);
  assert.equal(edited.food.nutrients.energy_kcal, 200);

  const entryAfter = userData.getDiaryEntry(db, entry.id);
  assert.ok(entryAfter);
  assert.equal(entryAfter.nutritionSnapshot.energy_kcal, 130);
  assert.equal(entryAfter.nutritionSnapshot.protein, 17);

  // Archive hides from default list
  const archived = saveCustom.archiveCustomFoodSafe(db, food.id);
  assert.equal(archived.ok, true);
  assert.equal(archived.food.isArchived, true);
  const active = userData.listCustomFoods(db);
  assert.equal(active.find((f) => f.id === food.id), undefined);
  const withArchived = userData.listCustomFoods(db, { includeArchived: true });
  assert.ok(withArchived.find((f) => f.id === food.id));

  // Snapshot still untouched after archive
  const entryFinal = userData.getDiaryEntry(db, entry.id);
  assert.equal(entryFinal.nutritionSnapshot.energy_kcal, 130);
});

test('draft validation rejects missing macros and bad barcode', async () => {
  await loadMods();
  const missing = validateDraft.validateCustomFoodDraft(
    baseDraft({ energyKcalText: '' }),
  );
  assert.equal(missing.ok, false);

  const badBarcode = validateDraft.validateCustomFoodDraft(
    baseDraft({ barcodeRaw: '123' }),
  );
  assert.equal(badBarcode.ok, false);
});

test('create rejects invalid barcode via save path', async () => {
  const db = await openDb();
  const r = saveCustom.saveCustomFoodCreate(
    db,
    baseDraft({ barcodeRaw: '036000291453' }),
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /check digit|Barcode/i);
});
