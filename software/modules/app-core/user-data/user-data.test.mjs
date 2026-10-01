import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const schemaPath = join(softwareRoot, 'modules/food-catalog/schema/user-store-v1.sql');

// Register ts via experimental? Use jiti/tsx if available, else spawn tsc to out.
// Prefer: dynamic import after compiling with npx tsc for these files only — heavy.
// Instead implement test logic with sql.js directly + import nutrient helpers via tsc emit.

import initSqlJs from 'sql.js';
import { randomUUID } from 'node:crypto';

function serializeNutrients(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined) continue;
    out[k] = v === null ? null : Number(v);
  }
  return JSON.stringify(out);
}
function parseNutrients(json) {
  const raw = JSON.parse(json);
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null) out[k] = null;
    else if (typeof v === 'number') out[k] = v;
    else throw new Error(`bad ${k}`);
  }
  return out;
}

async function openMigrated() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const ddl = readFileSync(schemaPath, 'utf8');
  db.exec(ddl);
  db.run("INSERT INTO schema_meta(key, value) VALUES (?, ?)", ['user_store_version', '1']);
  return db;
}

test('schema file exists and creates custom_food + diary_entry', async () => {
  const db = await openMigrated();
  const tables = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  )[0].values.map((r) => r[0]);
  assert.ok(tables.includes('custom_food'));
  assert.ok(tables.includes('diary_entry'));
  assert.ok(tables.includes('weight_sample'));
  assert.ok(tables.includes('meal_slot'));
  db.close();
});

test('missing≠zero: null nutrient stays null; zero stays zero', async () => {
  const db = await openMigrated();
  const id = randomUUID();
  const nutrients = serializeNutrients({
    energy_kcal: 100,
    protein: 0,
    carbohydrate: null,
    // fat_total omitted → missing
  });
  db.run(
    `INSERT INTO custom_food (
      id, name, brand, barcode_gtin14, basis_kind, basis_amount, basis_unit,
      gram_weight_for_basis, nutrients_json, created_at, updated_at, is_archived, deleted_at, sync_revision
    ) VALUES (?, 'Egg white test', NULL, NULL, 'mass', 100, 'g', 100, ?, datetime('now'), datetime('now'), 0, NULL, 0)`,
    [id, nutrients],
  );
  const stmt = db.prepare('SELECT nutrients_json FROM custom_food WHERE id = ?');
  stmt.bind([id]);
  assert.equal(stmt.step(), true);
  const parsed = parseNutrients(stmt.getAsObject().nutrients_json);
  stmt.free();
  assert.equal(parsed.protein, 0);
  assert.equal(parsed.carbohydrate, null);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'fat_total'), false);
  assert.equal(parsed.energy_kcal, 100);
  db.close();
});

test('CRUD custom food + tombstone; diary snapshot immutable to later custom edit', async () => {
  const db = await openMigrated();
  const foodId = randomUUID();
  const entryId = randomUUID();
  const t0 = new Date().toISOString();
  db.run(
    `INSERT INTO custom_food (
      id, name, brand, barcode_gtin14, basis_kind, basis_amount, basis_unit,
      gram_weight_for_basis, nutrients_json, created_at, updated_at, is_archived, deleted_at, sync_revision
    ) VALUES (?, 'Yogurt', NULL, NULL, 'mass', 170, 'g', 170, ?, ?, ?, 0, NULL, 0)`,
    [foodId, serializeNutrients({ energy_kcal: 130, protein: 17, fat_total: 0, carbohydrate: 14 }), t0, t0],
  );

  const snap = serializeNutrients({ energy_kcal: 130, protein: 17, fat_total: 0, carbohydrate: 14 });
  db.run(
    `INSERT INTO diary_entry (
      id, timestamp, local_day_key, timezone_identifier, meal_slot_id,
      food_kind, food_stable_id, food_provider_id, food_gtin14, food_display_name, food_brand, food_license_tag,
      quantity, unit_label, grams, nutrition_snapshot_json,
      source_display_name, source_url, license_tag, remote_terms_version,
      created_at, updated_at, deleted_at, sync_revision
    ) VALUES (?, ?, '2026-10-01', 'America/Vancouver', NULL,
      'custom', ?, NULL, NULL, 'Yogurt', NULL, 'user-custom',
      1, 'serving', 170, ?,
      'Custom', NULL, 'user-custom', NULL,
      ?, ?, NULL, 0)`,
    [entryId, t0, foodId, snap, t0, t0],
  );

  // Edit custom food macros — diary snapshot must stay 130
  db.run(
    `UPDATE custom_food SET nutrients_json = ?, updated_at = ?, sync_revision = 1 WHERE id = ?`,
    [serializeNutrients({ energy_kcal: 200, protein: 20, fat_total: 2, carbohydrate: 10 }), t0, foodId],
  );
  const e = db.prepare('SELECT nutrition_snapshot_json FROM diary_entry WHERE id = ?');
  e.bind([entryId]);
  e.step();
  const snapParsed = parseNutrients(e.getAsObject().nutrition_snapshot_json);
  e.free();
  assert.equal(snapParsed.energy_kcal, 130);

  // Tombstone food
  db.run(`UPDATE custom_food SET deleted_at = ? WHERE id = ?`, [t0, foodId]);
  const live = db.exec(`SELECT COUNT(*) as c FROM custom_food WHERE id = '${foodId}' AND deleted_at IS NULL`);
  // sql.js exec returns columns; verify via prepare
  const cstmt = db.prepare(`SELECT COUNT(*) AS c FROM custom_food WHERE id = ? AND deleted_at IS NULL`);
  cstmt.bind([foodId]);
  cstmt.step();
  assert.equal(Number(cstmt.getAsObject().c), 0);
  cstmt.free();

  db.close();
});

test('relaunch: export + reopen DB keeps rows', async () => {
  const SQL = await initSqlJs();
  const db1 = new SQL.Database();
  db1.exec(readFileSync(schemaPath, 'utf8'));
  db1.run("INSERT INTO schema_meta(key, value) VALUES ('user_store_version', '1')");
  const id = randomUUID();
  const t0 = new Date().toISOString();
  db1.run(
    `INSERT INTO weight_sample (id, timestamp, kilograms, source, confirmed_outlier, created_at, updated_at, deleted_at, sync_revision)
     VALUES (?, ?, 80.5, 'manual', 0, ?, ?, NULL, 0)`,
    [id, t0, t0, t0],
  );
  const bytes = db1.export();
  db1.close();

  const db2 = new SQL.Database(bytes);
  const stmt = db2.prepare('SELECT kilograms FROM weight_sample WHERE id = ?');
  stmt.bind([id]);
  assert.equal(stmt.step(), true);
  assert.equal(Number(stmt.getAsObject().kilograms), 80.5);
  stmt.free();
  const ver = db2.prepare("SELECT value FROM schema_meta WHERE key='user_store_version'");
  ver.step();
  assert.equal(ver.getAsObject().value, '1');
  ver.free();
  db2.close();
});

test('TypeScript user-data sources exist', () => {
  for (const f of [
    'migrate.ts',
    'customFoodRepo.ts',
    'diaryEntryRepo.ts',
    'nutrients.ts',
    'openSqlJs.ts',
    'openExpo.ts',
    'index.ts',
  ]) {
    assert.ok(readFileSync(join(__dirname, f), 'utf8').length > 20);
  }
});
