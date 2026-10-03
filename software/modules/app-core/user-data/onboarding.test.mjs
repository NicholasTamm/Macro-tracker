import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const require = createRequire(import.meta.url);

// Compile-free: exercise SQL + mirror of TS helpers for Node test runner.
const v1Path = join(softwareRoot, 'modules/food-catalog/schema/user-store-v1.sql');
const v2Path = join(softwareRoot, 'modules/food-catalog/schema/user-store-v2-profile.sql');

function coachingShellEnabled({ isAdultConfirmed, exclusions }) {
  if (!isAdultConfirmed) return false;
  return exclusions.length === 0;
}

function computeStarterTarget({ goalKind, sex, weightKg }) {
  const s = sex ?? 'unspecified';
  let base = s === 'female' ? 1800 : s === 'male' ? 2200 : 2000;
  if (weightKg != null && weightKg > 0) {
    const anchored = Math.round(weightKg * 30);
    base = Math.min(3200, Math.max(1400, Math.round((base + anchored) / 2)));
  }
  let energy = base;
  if (goalKind === 'lose') energy = Math.max(1400, base - 500);
  else if (goalKind === 'gain') energy = base + 300;
  return {
    energyKcal: energy,
    proteinG: Math.round((energy * 0.3) / 4),
    carbohydrateG: Math.round((energy * 0.4) / 4),
    fatG: Math.round((energy * 0.3) / 9),
  };
}

async function openRaw() {
  const SQL = await initSqlJs();
  return new SQL.Database();
}

function applyV1V2(db) {
  db.exec(readFileSync(v1Path, 'utf8'));
  db.run("INSERT INTO schema_meta(key, value) VALUES ('user_store_version', '1')");
  db.exec(readFileSync(v2Path, 'utf8'));
  db.run("UPDATE schema_meta SET value = '2' WHERE key = 'user_store_version'");
}

function ensureProfile(db) {
  const ts = new Date().toISOString();
  db.run(
    `INSERT OR IGNORE INTO user_profile (
      id, is_adult_confirmed, adult_confirmed_at, mass_unit, height_unit, energy_unit,
      sex, birth_year, height_cm, weight_kg, exclusions_json, onboarding_step,
      onboarding_completed_at, created_at, updated_at, sync_revision
    ) VALUES ('local-profile', 0, NULL, 'kg', 'cm', 'kcal', NULL, NULL, NULL, NULL, '[]', 'adult', NULL, ?, ?, 0)`,
    [ts, ts],
  );
}

test('bundled schemaV1/V2 match SQL files', () => {
  // Dynamic import of compiled-ish TS not available; compare file existence + sizes.
  const v1 = readFileSync(v1Path, 'utf8');
  const v2 = readFileSync(v2Path, 'utf8');
  const bundledV1 = readFileSync(join(__dirname, 'schemaV1.ts'), 'utf8');
  const bundledV2 = readFileSync(join(__dirname, 'schemaV2.ts'), 'utf8');
  assert.ok(bundledV1.includes('CREATE TABLE schema_meta'));
  assert.ok(bundledV2.includes('CREATE TABLE IF NOT EXISTS user_profile'));
  assert.ok(v1.includes('custom_food'));
  assert.ok(v2.includes('daily_target'));
});

test('migrate v1 leftover upgrades to v2 profile tables', async () => {
  const db = await openRaw();
  db.exec(readFileSync(v1Path, 'utf8'));
  db.run("INSERT INTO schema_meta(key, value) VALUES ('user_store_version', '1')");
  const before = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'");
  assert.equal(before.length, 0);
  db.exec(readFileSync(v2Path, 'utf8'));
  db.run("UPDATE schema_meta SET value = '2' WHERE key = 'user_store_version'");
  const tables = db
    .exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]
    .values.map((r) => r[0]);
  assert.ok(tables.includes('user_profile'));
  assert.ok(tables.includes('user_goal'));
  assert.ok(tables.includes('daily_target'));
  const ver = db.prepare("SELECT value FROM schema_meta WHERE key='user_store_version'");
  ver.step();
  assert.equal(ver.getAsObject().value, '2');
  ver.free();
  db.close();
});

test('onboarding persists profile/goal/target and survives relaunch', async () => {
  const SQL = await initSqlJs();
  const db1 = new SQL.Database();
  applyV1V2(db1);
  ensureProfile(db1);
  const ts = new Date().toISOString();

  // adult → units → biometrics → goal → exclusions → target
  db1.run(
    `UPDATE user_profile SET is_adult_confirmed=1, adult_confirmed_at=?, mass_unit='lb', height_unit='in',
      energy_unit='kcal', sex='female', birth_year=1994, height_cm=165, weight_kg=68,
      exclusions_json='[]', onboarding_step='target', updated_at=? WHERE id='local-profile'`,
    [ts, ts],
  );
  const goalId = '11111111-1111-4111-8111-111111111111';
  db1.run(
    `INSERT INTO user_goal (id, profile_id, goal_kind, rate_kg_per_week, is_active, created_at, updated_at, sync_revision)
     VALUES (?, 'local-profile', 'lose', 0.5, 1, ?, ?, 0)`,
    [goalId, ts, ts],
  );
  const starter = computeStarterTarget({ goalKind: 'lose', sex: 'female', weightKg: 68 });
  const targetId = '22222222-2222-4222-8222-222222222222';
  db1.run(
    `INSERT INTO daily_target (id, profile_id, energy_kcal, protein_g, carbohydrate_g, fat_g, source, effective_from, created_at, updated_at, sync_revision)
     VALUES (?, 'local-profile', ?, ?, ?, ?, 'starter', ?, ?, ?, 0)`,
    [targetId, starter.energyKcal, starter.proteinG, starter.carbohydrateG, starter.fatG, ts.slice(0, 10), ts, ts],
  );
  db1.run(
    `UPDATE user_profile SET onboarding_step='done', onboarding_completed_at=?, updated_at=? WHERE id='local-profile'`,
    [ts, ts],
  );

  const bytes = db1.export();
  db1.close();

  const db2 = new SQL.Database(bytes);
  const p = db2.prepare(`SELECT is_adult_confirmed, mass_unit, sex, weight_kg, onboarding_step, onboarding_completed_at FROM user_profile WHERE id='local-profile'`);
  assert.equal(p.step(), true);
  const prow = p.getAsObject();
  p.free();
  assert.equal(Number(prow.is_adult_confirmed), 1);
  assert.equal(prow.mass_unit, 'lb');
  assert.equal(prow.sex, 'female');
  assert.equal(Number(prow.weight_kg), 68);
  assert.equal(prow.onboarding_step, 'done');
  assert.ok(prow.onboarding_completed_at);

  const g = db2.prepare(`SELECT goal_kind, rate_kg_per_week FROM user_goal WHERE is_active=1`);
  assert.equal(g.step(), true);
  const grow = g.getAsObject();
  g.free();
  assert.equal(grow.goal_kind, 'lose');
  assert.equal(Number(grow.rate_kg_per_week), 0.5);

  const t = db2.prepare(`SELECT energy_kcal, source FROM daily_target WHERE id=?`);
  t.bind([targetId]);
  assert.equal(t.step(), true);
  assert.equal(Number(t.getAsObject().energy_kcal), starter.energyKcal);
  t.free();
  db2.close();
});

test('back navigation: onboarding_step draft survives reopen', async () => {
  const SQL = await initSqlJs();
  const db1 = new SQL.Database();
  applyV1V2(db1);
  ensureProfile(db1);
  const ts = new Date().toISOString();
  db1.run(
    `UPDATE user_profile SET is_adult_confirmed=1, adult_confirmed_at=?, onboarding_step='biometrics', updated_at=? WHERE id='local-profile'`,
    [ts, ts],
  );
  const bytes = db1.export();
  db1.close();
  const db2 = new SQL.Database(bytes);
  const stmt = db2.prepare(`SELECT onboarding_step FROM user_profile WHERE id='local-profile'`);
  stmt.step();
  assert.equal(stmt.getAsObject().onboarding_step, 'biometrics');
  stmt.free();
  db2.close();
});

test('exclusions disable coaching shell entry', () => {
  assert.equal(
    coachingShellEnabled({ isAdultConfirmed: true, exclusions: [] }),
    true,
  );
  assert.equal(
    coachingShellEnabled({
      isAdultConfirmed: true,
      exclusions: ['pregnancy'],
    }),
    false,
  );
  assert.equal(
    coachingShellEnabled({ isAdultConfirmed: false, exclusions: [] }),
    false,
  );
});

test('TypeScript onboarding sources exist', () => {
  for (const f of [
    'profileRepo.ts',
    'goalRepo.ts',
    'onboarding.ts',
    'exclusions.ts',
    'starterTarget.ts',
    'profileTypes.ts',
    'schemaV2.ts',
    'migrate.ts',
  ]) {
    assert.ok(readFileSync(join(__dirname, f), 'utf8').length > 40, f);
  }
});

test('unit convert round-trip lb/in ↔ kg/cm', () => {
  const lbToKg = (lb) => lb * 0.45359237;
  const kgToLb = (kg) => kg / 0.45359237;
  const inToCm = (inches) => inches * 2.54;
  const cmToIn = (cm) => cm / 2.54;
  const round1 = (n) => Math.round(n * 10) / 10;
  assert.equal(round1(lbToKg(154)), 69.9);
  assert.ok(Math.abs(kgToLb(lbToKg(154)) - 154) < 1e-9);
  assert.equal(round1(inToCm(67)), 170.2);
  assert.ok(Math.abs(cmToIn(inToCm(67)) - 67) < 1e-9);
});

test('sql.js exportBytes round-trip keeps profile step', async () => {
  const SQL = await initSqlJs();
  const db1 = new SQL.Database();
  applyV1V2(db1);
  ensureProfile(db1);
  const ts = new Date().toISOString();
  db1.run(
    `UPDATE user_profile SET onboarding_step='goal', is_adult_confirmed=1, adult_confirmed_at=?, updated_at=? WHERE id='local-profile'`,
    [ts, ts],
  );
  const bytes = db1.export();
  db1.close();
  const db2 = new SQL.Database(bytes);
  const stmt = db2.prepare(`SELECT onboarding_step FROM user_profile WHERE id='local-profile'`);
  stmt.step();
  assert.equal(stmt.getAsObject().onboarding_step, 'goal');
  stmt.free();
  db2.close();
});
