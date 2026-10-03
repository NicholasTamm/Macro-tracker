import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { sha256Hex, verifySha256, assertSha256 } from './lib/checksum.mjs';
import {
  normalizeName,
  mapNutrients,
  normalizeUsdaDirectory,
  makeFoodId,
} from './lib/normalize.mjs';
import { emitSqliteCatalog } from './lib/emit-sqlite.mjs';
import { parseCsv } from './lib/csv.mjs';
import { loadPinnedSources, loadNutrientMap } from './lib/normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('normalizeName lowercases and collapses punctuation/whitespace', () => {
  assert.equal(
    normalizeName('Eggs, Grade A, Large, egg whole'),
    'eggs grade a large egg whole',
  );
  assert.equal(normalizeName('  Milk   3.25%  '), 'milk 3.25');
});

test('makeFoodId is deterministic source:external', () => {
  assert.equal(makeFoodId('usda-foundation', '748967'), 'usda-foundation:748967');
  assert.equal(makeFoodId('usda-sr-legacy', '173944'), 'usda-sr-legacy:173944');
});

test('checksum: verifySha256 passes on match and fails on mismatch', async () => {
  const dir = join(tmpdir(), `seed-checksum-${process.pid}`);
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'blob.bin');
  const payload = Buffer.from('macro-tracker-m1-06-fixture');
  await writeFile(file, payload);
  const good = sha256Hex(payload);
  const ok = await verifySha256(file, good);
  assert.equal(ok.ok, true);
  assert.equal(ok.actual, good);

  const bad = await verifySha256(file, '0'.repeat(64));
  assert.equal(bad.ok, false);
  assert.equal(bad.actual, good);

  await assert.rejects(
    () => assertSha256(file, '0'.repeat(64)),
    (err) => err.code === 'CHECKSUM_MISMATCH',
  );
  await rm(dir, { recursive: true, force: true });
});

test('mapNutrients prefers Energy 1008 over Atwater 2047; keeps explicit zero', async () => {
  const nutrientMap = await loadNutrientMap();
  const rows = [
    { nutrient_id: '1008', amount: '148.0', derivation_id: '1' },
    { nutrient_id: '2047', amount: '143', derivation_id: '1' },
    { nutrient_id: '1003', amount: '12.4' },
    { nutrient_id: '1004', amount: '9.96' },
    { nutrient_id: '1005', amount: '0.96' },
    { nutrient_id: '1079', amount: '0.0' },
  ];
  const mapped = mapNutrients(rows, nutrientMap);
  assert.equal(mapped.get('energy_kcal').amount, 148);
  assert.equal(mapped.get('energy_kcal').sourceNutrientId, '1008');
  assert.equal(mapped.get('fiber').amount, 0);
  assert.equal(mapped.has('sugars_total'), false); // missing ≠ zero
});

test('mapNutrients falls back to Atwater when 1008 absent', async () => {
  const nutrientMap = await loadNutrientMap();
  const mapped = mapNutrients(
    [
      { nutrient_id: '2047', amount: '381.6' },
      { nutrient_id: '1003', amount: '13.5' },
      { nutrient_id: '1004', amount: '5.9' },
      { nutrient_id: '1005', amount: '68.7' },
    ],
    nutrientMap,
  );
  assert.equal(mapped.get('energy_kcal').amount, 381.6);
  assert.equal(mapped.get('energy_kcal').sourceNutrientId, '2047');
});

test('parseCsv handles quotes and commas', () => {
  const rows = parseCsv('"a","b"\n"1","hello, world"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].b, 'hello, world');
});

test('fixture normalize: Foundation/SR filter + golden macros', async () => {
  const foundation = await normalizeUsdaDirectory(join(__dirname, 'fixture/foundation'));
  assert.equal(foundation.foods.length, 1);
  const egg = foundation.foods[0];
  assert.equal(egg.foodId, 'usda-foundation:748967');
  assert.equal(egg.dataType, 'foundation');
  assert.equal(egg.normalizedName, 'eggs grade a large egg whole');
  const eggNut = Object.fromEntries(egg.nutrients.map((n) => [n.nutrientId, n.amountPer100g]));
  assert.equal(eggNut.energy_kcal, 148);
  assert.equal(eggNut.protein, 12.4);
  assert.equal(eggNut.carbohydrate, 0.96);
  assert.equal(eggNut.fat_total, 9.96);
  assert.equal(egg.servings[0].unit, 'egg');
  assert.equal(egg.servings[0].gramWeight, 50.3);

  const sr = await normalizeUsdaDirectory(join(__dirname, 'fixture/sr_legacy'));
  assert.ok(sr.foods.length >= 2);
  assert.equal(sr.foods.length, 13);
  const banana = sr.foods.find((f) => f.externalId === '173944');
  assert.ok(banana);
  assert.equal(banana.dataType, 'sr_legacy');
  assert.equal(banana.foodId, 'usda-sr-legacy:173944');
  const bNut = Object.fromEntries(banana.nutrients.map((n) => [n.nutrientId, n.amountPer100g]));
  assert.equal(bNut.energy_kcal, 89);
  assert.equal(bNut.carbohydrate, 22.84);
});

test('emitSqliteCatalog writes schema-compatible FoodSeed + manifest with source hash', async () => {
  const pinned = await loadPinnedSources();
  const foundation = await normalizeUsdaDirectory(join(__dirname, 'fixture/foundation'));
  const sr = await normalizeUsdaDirectory(join(__dirname, 'fixture/sr_legacy'));
  const foods = [...foundation.foods, ...sr.foods];
  const outDir = join(tmpdir(), `seed-emit-${process.pid}`);
  await rm(outDir, { recursive: true, force: true });

  const emitted = await emitSqliteCatalog({
    foods,
    pinnedSources: pinned,
    seedVersion: 'test.fixture.1',
    outDir,
    mode: 'fixture',
    retrievedAt: '2026-10-03T12:00:00Z',
  });

  const { sqliteQuery } = await import('./lib/emit-sqlite.mjs');
  assert.equal(await sqliteQuery(emitted.dbPath, 'SELECT COUNT(*) FROM food'), String(foods.length));
  assert.equal(
    await sqliteQuery(emitted.dbPath, 'SELECT GROUP_CONCAT(data_type) FROM (SELECT DISTINCT data_type FROM food ORDER BY 1)'),
    'foundation,sr_legacy',
  );
  const srcUrl = await sqliteQuery(
    emitted.dbPath,
    "SELECT source_url FROM source WHERE source_id='usda-foundation'",
  );
  const srcHash = await sqliteQuery(
    emitted.dbPath,
    "SELECT archive_sha256 FROM source WHERE source_id='usda-foundation'",
  );
  assert.equal(srcUrl, pinned.sources[0].sourceUrl);
  assert.equal(srcHash, pinned.sources[0].archiveSha256);

  const fts = await sqliteQuery(
    emitted.dbPath,
    "SELECT food_id FROM food_fts WHERE food_fts MATCH 'egg' LIMIT 1",
  );
  assert.equal(fts, 'usda-foundation:748967');

  const missing = await sqliteQuery(
    emitted.dbPath,
    `SELECT COUNT(*) FROM food AS f
    CROSS JOIN (
      SELECT 'energy_kcal' AS id UNION ALL SELECT 'protein'
      UNION ALL SELECT 'carbohydrate' UNION ALL SELECT 'fat_total'
    ) AS required
    LEFT JOIN food_nutrient AS n ON n.food_id=f.food_id AND n.nutrient_id=required.id
    WHERE n.food_id IS NULL`,
  );
  assert.equal(missing, '0');

  const manifest = JSON.parse(await readFile(emitted.manifestPath, 'utf8'));
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.content.foodCount, foods.length);
  assert.ok(manifest.sources.every((s) => /^[0-9a-f]{64}$/.test(s.archiveSHA256)));
  assert.ok(manifest.sources.every((s) => s.downloadURL.startsWith('https://fdc.nal.usda.gov/')));

  await rm(outDir, { recursive: true, force: true });
});

test('pinned-sources.json documents both Foundation and SR Legacy pins', async () => {
  const pinned = await loadPinnedSources();
  assert.equal(pinned.sources.length, 2);
  for (const s of pinned.sources) {
    assert.match(s.archiveSha256, /^[0-9a-f]{64}$/);
    assert.match(s.sourceUrl, /^https:\/\/fdc\.nal\.usda\.gov\/fdc-datasets\//);
  }
});
