// Issue 125 demo smoke: real sql.js store — log to target, "reload" from
// exported bytes, confirm the card condition holds and the haptic flag is
// claimed exactly once.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'smoke-125-'));
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(
    join(dir, 'entry.ts'),
    [
      `export * from '${softwareRoot}/modules/app-core/user-data/index.ts';`,
      `export { loadTodayDay } from '${softwareRoot}/modules/diary/loadTodayDay.ts';`,
      `export * from '${softwareRoot}/modules/diary/goalHit.ts';`,
    ].join('\n'),
  );
  execFileSync(
    join(softwareRoot, 'node_modules/esbuild/bin/esbuild'),
    [join(dir, 'entry.ts'), '--bundle', '--platform=node', '--format=esm', `--outfile=${join(dir, 'm.js')}`,
      '--external:sql.js', '--external:expo-sqlite', '--external:react', '--external:react-native'],
    { cwd: softwareRoot, stdio: 'pipe', env: { ...process.env, NODE_PATH: join(softwareRoot, 'node_modules') } },
  );
  execFileSync('ln', ['-s', join(softwareRoot, 'node_modules'), join(dir, 'node_modules')]);
  const m = await import(pathToFileURL(join(dir, 'm.js')).href);

  const today = '2026-10-28';
  let db = await m.openSqlJsDatabase();
  m.migrateUserStore(db);
  m.ensureProfile(db);
  m.saveStarterTarget(db, { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 70 }, undefined, '2026-10-01');
  m.ensureDefaultMealSlots(db);
  const slot = m.listMealSlots(db)[0];
  const log = (kcal, protein) =>
    m.createDiaryEntry(db, {
      timestamp: `${today}T18:00:00.000Z`, localDayKey: today, timezoneIdentifier: 'America/Vancouver',
      mealSlotId: slot.id, foodKind: 'seed', foodStableId: `food-${kcal}`, foodDisplayName: 'Smoke food',
      foodLicenseTag: 'USDA', quantity: 1, unitLabel: 'serving', grams: 100,
      nutritionSnapshot: { energy_kcal: kcal, protein, fat_total: 10, carbohydrate: 50 },
      sourceDisplayName: 'USDA', licenseTag: 'USDA',
    });
  log(900, 60);
  let view = m.loadTodayDay(db, today);
  assert.equal(m.isDailyGoalHit(view.rawTotals, view.goals), false, 'below target: no card');
  log(1050, 80);
  view = m.loadTodayDay(db, today);
  const hit = m.isDailyGoalHit(view.rawTotals, view.goals);
  assert.equal(hit, true, `at target: ${JSON.stringify(view.totals)} vs ${JSON.stringify(view.goals)}`);
  assert.equal(m.claimGoalHitCelebration(db, { viewDayKey: today, todayKey: today, hit }), true, 'first claim fires haptic');

  const bytes = db.exportBytes();
  db.close();
  db = await m.openSqlJsDatabase(bytes); // reload
  view = m.loadTodayDay(db, today);
  assert.equal(m.shouldShowGoalHitCard({ viewDayKey: today, todayKey: today, hit: m.isDailyGoalHit(view.rawTotals, view.goals) }), true, 'card after reload');
  assert.equal(m.getCelebratedGoalDay(db), today, 'flag persisted');
  assert.equal(m.claimGoalHitCelebration(db, { viewDayKey: today, todayKey: today, hit: true }), false, 'no second haptic after reload');
  db.close();
  console.log(`OK: goal hit at ${Math.round(view.totals.calories)} kcal / ${Math.round(view.totals.protein)} g protein; haptic flag set once`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
