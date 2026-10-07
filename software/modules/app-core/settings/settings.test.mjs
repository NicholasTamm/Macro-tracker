import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const bundleDir = join(__dirname, '.bundle');
let userData;
let settings;

before(async () => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');
  const bundle = (input, output) => execFileSync(esbuildBin, [
    input,
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${join(bundleDir, output)}`,
    '--external:sql.js',
    '--external:expo-sqlite',
  ], { cwd: softwareRoot, stdio: 'pipe' });
  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(join(__dirname, 'index.ts'), 'settings.js');
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  settings = await import(pathToFileURL(join(bundleDir, 'settings.js')).href);
});

async function openDb() {
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

test('v3 migration persists and safely parses theme preference', async () => {
  const db = await openDb();
  assert.equal(userData.USER_STORE_SCHEMA_VERSION, '3');
  assert.equal(settings.getThemePreference(db), 'system');
  settings.saveThemePreference(db, 'dark');
  assert.equal(settings.getThemePreference(db), 'dark');
  db.run("UPDATE app_setting SET value = 'unexpected' WHERE key = 'theme_preference'");
  assert.equal(settings.getThemePreference(db), 'system');
  db.close();
});

test('existing v2 user store upgrades to the v3 settings table', async () => {
  const db = await userData.openSqlJsDatabase();
  db.exec(userData.USER_STORE_V1_SQL);
  db.run("INSERT INTO schema_meta(key, value) VALUES ('user_store_version', '1')");
  db.exec(userData.USER_STORE_V2_PROFILE_SQL);
  db.run("UPDATE schema_meta SET value = '2' WHERE key = 'user_store_version'");
  const result = userData.migrateUserStore(db);
  assert.equal(result.version, '3');
  assert.ok(db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='app_setting'"));
  db.close();
});

test('unit preference changes are display-only and preserve canonical values', async () => {
  const db = await openDb();
  userData.ensureProfile(db);
  userData.updateProfile(db, { heightCm: 180, weightKg: 80 });
  userData.saveStarterTarget(db, {
    energyKcal: 2400,
    proteinG: 150,
    carbohydrateG: 250,
    fatG: 80,
  });

  userData.updateProfile(db, settings.unitPreferencePatch({
    massUnit: 'lb',
    heightUnit: 'in',
    energyUnit: 'kJ',
  }));

  const profile = userData.getProfile(db);
  const target = userData.getLatestTarget(db);
  assert.equal(profile.massUnit, 'lb');
  assert.equal(profile.heightUnit, 'in');
  assert.equal(profile.energyUnit, 'kJ');
  assert.equal(profile.weightKg, 80);
  assert.equal(profile.heightCm, 180);
  assert.equal(target.energyKcal, 2400);
  db.close();
});

test('profile display conversion validates positive finite values', () => {
  assert.equal(settings.displayMassToKg('154', 'lb'), 69.9);
  assert.equal(settings.displayHeightToCm('67', 'in'), 170.2);
  assert.equal(settings.displayMassToKg('-1', 'kg'), null);
  assert.equal(settings.displayHeightToCm('not-a-number', 'cm'), null);
  assert.equal(settings.formatEnergy(100, 'kJ'), '418');
});

test('profile save preserves canonical measurements that were not edited', async () => {
  const db = await openDb();
  userData.ensureProfile(db);
  userData.updateProfile(db, { heightCm: 180, weightKg: 80 });

  const heightDisplay = settings.formatHeight(180, 'in');
  const weightDisplay = settings.formatMass(80, 'lb');
  const patch = settings.profileEditPatch({
    sex: 'unspecified',
    birthYear: 1990,
    heightCm: settings.displayHeightToCm(heightDisplay, 'in'),
    weightKg: settings.displayMassToKg(weightDisplay, 'lb'),
    heightEdited: false,
    weightEdited: false,
  });
  userData.updateProfile(db, patch);

  assert.equal(heightDisplay, '70.9');
  assert.equal(settings.displayHeightToCm(heightDisplay, 'in'), 180.1);
  assert.equal(userData.getProfile(db).heightCm, 180);
  assert.equal(userData.getProfile(db).weightKg, 80);

  userData.updateProfile(db, settings.profileEditPatch({
    sex: 'unspecified',
    birthYear: 1990,
    heightCm: 181,
    weightKg: 81,
    heightEdited: true,
    weightEdited: true,
  }));
  assert.equal(userData.getProfile(db).heightCm, 181);
  assert.equal(userData.getProfile(db).weightKg, 81);
  db.close();
});

test('profile birth year requires the user to remain at least 18', () => {
  assert.equal(settings.isAdultBirthYear(2006, 2024), true);
  assert.equal(settings.isAdultBirthYear(2007, 2024), false);
  assert.equal(settings.isAdultBirthYear(1899, 2024), false);
});

test('energy input conversion preserves canonical kcal storage', () => {
  assert.equal(settings.formatEnergyInput(100, 'kJ'), '418.4');
  assert.equal(settings.energyInputToKcalText('418.4', 'kJ'), '100');
  assert.equal(settings.energyInputToKcalText('100', 'kcal'), '100');
  assert.equal(settings.energyInputToKcalText('invalid', 'kJ'), 'invalid');
});

test('energy accessibility units are spoken without abbreviations', () => {
  assert.equal(settings.energyUnitForSpeech('kcal'), 'kilocalories');
  assert.equal(settings.energyUnitForSpeech('kJ'), 'kilojoules');
});

test('settings routes hydrate drafts once persisted data is ready', () => {
  for (const route of ['units.tsx', 'profile.tsx']) {
    const source = readFileSync(join(softwareRoot, 'app/settings', route), 'utf8');
    assert.match(source, /useEffect\(\(\) =>/);
    assert.match(source, /!ready \|\| !profile \|\| hydrated\.current/);
    assert.match(source, /hydrated\.current = true/);
  }
});

test('USDA citation uses manifest dataset releases and has a static fallback', () => {
  const citation = settings.buildUsdaCitation({ sources: [
    { id: 'usda-foundation', release: '2024-10-31+fixture' },
    { id: 'usda-sr-legacy', release: '2018-04+fixture' },
  ] });
  assert.match(citation, /U\.S\. Department of Agriculture, Agricultural Research Service\. FoodData Central, 2024\. fdc\.nal\.usda\.gov\./);
  assert.match(citation, /Foundation Foods/);
  assert.match(citation, /SR Legacy/);
  assert.equal(settings.buildUsdaCitation(null), settings.USDA_CITATION_FALLBACK);
});

test('license data covers key bundled dependencies', () => {
  for (const name of ['Expo', 'React Native', 'React', 'Expo Router', 'Expo SQLite', 'sql.js']) {
    assert.ok(settings.BUNDLED_LICENSES.some((entry) => entry.name === name && entry.license));
  }
});
