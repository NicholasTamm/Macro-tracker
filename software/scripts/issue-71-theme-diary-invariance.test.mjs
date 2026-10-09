import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '..');
const bundleDir = join(__dirname, '.bundle', 'issue-71');
const fixturePath = join(
  softwareRoot,
  'modules/food-catalog/assets/FoodSeed.fixture.sqlite',
);

let buildFoodDetail;
let loadToday;
let logFood;
let openSeedFileViaSqlJs;
let providerState;
let settings;
let userData;
let LocalFoodRepository;

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
    '--external:node-sqlite3-wasm',
  ], { cwd: softwareRoot, stdio: 'pipe' });

  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(join(softwareRoot, 'modules/app-core/settings/index.ts'), 'settings.js');
  bundle(join(softwareRoot, 'components/userDataState.ts'), 'userDataState.js');
  bundle(join(softwareRoot, 'modules/diary/loadTodayDay.ts'), 'loadTodayDay.js');
  bundle(join(softwareRoot, 'modules/diary/food-detail/buildFoodDetail.ts'), 'buildFoodDetail.js');
  bundle(join(softwareRoot, 'modules/diary/food-detail/logFoodEntry.ts'), 'logFoodEntry.js');
  bundle(
    join(softwareRoot, 'modules/food-catalog/local-food-repo/LocalFoodRepository.ts'),
    'LocalFoodRepository.js',
  );
  bundle(
    join(softwareRoot, 'modules/food-catalog/local-food-repo/openSeedNode.ts'),
    'openSeedNode.js',
  );

  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  settings = await import(pathToFileURL(join(bundleDir, 'settings.js')).href);
  providerState = await import(pathToFileURL(join(bundleDir, 'userDataState.js')).href);
  loadToday = await import(pathToFileURL(join(bundleDir, 'loadTodayDay.js')).href);
  buildFoodDetail = await import(pathToFileURL(join(bundleDir, 'buildFoodDetail.js')).href);
  logFood = await import(pathToFileURL(join(bundleDir, 'logFoodEntry.js')).href);
  LocalFoodRepository = (
    await import(pathToFileURL(join(bundleDir, 'LocalFoodRepository.js')).href)
  ).LocalFoodRepository;
  ({ openSeedFileViaSqlJs } = await import(
    pathToFileURL(join(bundleDir, 'openSeedNode.js')).href
  ));
});

async function openUserDb(bytes) {
  const db = await userData.openSqlJsDatabase(bytes);
  userData.migrateUserStore(db);
  return db;
}

async function openSeedRepo() {
  const db = await openSeedFileViaSqlJs(fixturePath);
  return new LocalFoodRepository(db);
}

function rawDiary(db) {
  return db.all('SELECT * FROM diary_entry ORDER BY id');
}

function bananaLogInput(db, repo) {
  userData.ensureDefaultMealSlots(db);
  const breakfast = userData.listMealSlots(db).find((slot) => slot.name === 'Breakfast');
  assert.ok(breakfast);
  const model = buildFoodDetail.buildSeedFoodDetail(repo, 'usda-sr-legacy:173944');
  assert.ok(model);
  assert.equal(model.displayName, 'Bananas, raw');
  return {
    intentId: '312c65c0-88bd-46a2-876d-bdce35fa5839',
    model,
    quantity: 100,
    unit: { kind: 'grams' },
    mealSlotId: breakfast.id,
    timestamp: '2026-10-08T15:00:00.000Z',
    localDayKey: '2026-10-08',
    timezoneIdentifier: 'America/Vancouver',
  };
}

test('theme saves, provider refreshes, Today reload, and sql.js reopen preserve every diary field', async () => {
  let db = await openUserDb();
  const repo = await openSeedRepo();
  try {
    providerState.loadUserDataProviderState(db);
    const banana = logFood.logFoodToDiary(db, bananaLogInput(db, repo));
    assert.equal(banana.ok, true);

    const deleted = userData.createDiaryEntry(db, {
      id: '09f8193b-9838-4b81-b615-f991bcc9d3ad',
      timestamp: '2026-10-08T16:00:00.000Z',
      localDayKey: '2026-10-08',
      timezoneIdentifier: 'America/Vancouver',
      mealSlotId: banana.entry.mealSlotId,
      foodKind: 'seed',
      foodStableId: 'regression:tombstone',
      foodDisplayName: 'Deleted regression row',
      foodLicenseTag: 'test',
      quantity: 1,
      unitLabel: 'serving',
      grams: 42,
      nutritionSnapshot: { energy_kcal: 99, protein: 1.2 },
      sourceDisplayName: 'Regression fixture',
      licenseTag: 'test',
    });
    userData.tombstoneDiaryEntry(db, deleted.id);

    const expectedDiary = JSON.stringify(rawDiary(db));
    assert.equal(loadToday.loadTodayDay(db, '2026-10-08').entryCount, 1);

    for (const theme of ['dark', 'dark', 'light', 'system']) {
      const profile = userData.getProfile(db);
      userData.updateProfile(db, settings.unitPreferencePatch({
        massUnit: profile.massUnit,
        heightUnit: profile.heightUnit,
        energyUnit: profile.energyUnit,
      }));
      settings.saveThemePreference(db, theme);
      const refreshed = providerState.loadUserDataProviderState(db);
      assert.equal(refreshed.themePreference, theme);
      assert.equal(JSON.stringify(rawDiary(db)), expectedDiary);
      assert.equal(loadToday.loadTodayDay(db, '2026-10-08').entryCount, 1);
    }

    const persisted = db.exportBytes();
    db.close();
    db = await openUserDb(persisted);
    const reloaded = providerState.loadUserDataProviderState(db);
    assert.equal(reloaded.themePreference, 'system');
    assert.equal(JSON.stringify(rawDiary(db)), expectedDiary);
    assert.equal(loadToday.loadTodayDay(db, '2026-10-08').entryCount, 1);
    assert.equal(
      userData.getDiaryEntry(db, deleted.id, { includeDeleted: true }).deletedAt !== null,
      true,
    );
  } finally {
    repo.close();
    db.close();
  }
});

test('replayed food-log intent returns the original banana row without mutation', async () => {
  const db = await openUserDb();
  const repo = await openSeedRepo();
  try {
    const input = bananaLogInput(db, repo);
    const first = logFood.logFoodToDiary(db, input);
    assert.equal(first.ok, true);
    const afterFirst = JSON.stringify(rawDiary(db));

    const replay = logFood.logFoodToDiary(db, input);
    assert.equal(replay.ok, true);
    assert.equal(replay.entry.id, first.entry.id);
    assert.equal(JSON.stringify(rawDiary(db)), afterFirst);
    assert.equal(userData.listDiaryEntriesForDay(db, input.localDayKey).length, 1);
    assert.equal(
      userData.getRecentFood(db, 'seed', input.model.foodStableId).useCount,
      1,
    );
  } finally {
    repo.close();
    db.close();
  }
});
