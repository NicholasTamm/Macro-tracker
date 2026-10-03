/**
 * M1-09 LocalFoodRepository ranking fixtures + open/read-only gates.
 * Builds a small ESM bundle from the TypeScript sources via esbuild, then
 * opens the bundled fixture seed with node-sqlite3-wasm (FTS5).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const fixtureSeed = join(softwareRoot, 'modules/food-catalog/assets/FoodSeed.fixture.sqlite');
const fixturesPath = join(__dirname, 'ranking-fixtures.json');
const bundleDir = join(__dirname, '.bundle');

let openSeedFile;
let LocalFoodRepository;
let WARM_COMMON_QUERY_P95_MS;

before(() => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');
  execFileSync(
    esbuildBin,
    [
      join(__dirname, 'openSeedNode.ts'),
      '--bundle',
      '--platform=node',
      '--format=esm',
      `--outfile=${join(bundleDir, 'openSeedNode.js')}`,
      '--external:sql.js',
      '--external:node-sqlite3-wasm',
    ],
    { cwd: softwareRoot, stdio: 'pipe' },
  );
  execFileSync(
    esbuildBin,
    [
      join(__dirname, 'LocalFoodRepository.ts'),
      '--bundle',
      '--platform=node',
      '--format=esm',
      `--outfile=${join(bundleDir, 'LocalFoodRepository.js')}`,
    ],
    { cwd: softwareRoot, stdio: 'pipe' },
  );
  WARM_COMMON_QUERY_P95_MS = 150;
});

async function loadRepoModules() {
  if (openSeedFile) return;
  ({ openSeedFile } = await import(pathToFileURL(join(bundleDir, 'openSeedNode.js')).href));
  ({ LocalFoodRepository } = await import(
    pathToFileURL(join(bundleDir, 'LocalFoodRepository.js')).href
  ));
}

function openRepo() {
  const db = openSeedFile(fixtureSeed);
  return new LocalFoodRepository(db);
}

test('fixture seed exists and opens read-only with FTS5', async () => {
  await loadRepoModules();
  assert.ok(readFileSync(fixtureSeed).length > 0);
  const repo = openRepo();
  const meta = repo.getMetadata();
  assert.equal(meta.catalogSchemaVersion, '1');
  assert.equal(meta.seedVersion, 'fixture.m1-09.1');
  assert.equal(meta.foodCount, 14);
  assert.equal(meta.ftsAvailable, true);

  const db = openSeedFile(fixtureSeed);
  assert.throws(() => db.run('DELETE FROM food'), /read-only/i);
  db.close();
  repo.close();
});

test('getFood + nutrients + servings for egg staple', async () => {
  await loadRepoModules();
  const repo = openRepo();
  const food = repo.getFood('usda-foundation:748967');
  assert.ok(food);
  assert.match(food.description, /egg/i);
  const nutrients = repo.getNutrients('usda-foundation:748967');
  const ids = nutrients.map((n) => n.nutrientId);
  assert.ok(ids.includes('energy_kcal'));
  assert.ok(ids.includes('protein'));
  const servings = repo.getServings('usda-foundation:748967');
  assert.ok(servings.length >= 1);
  assert.ok(servings.some((s) => s.isDefault));
  repo.close();
});

test('ranking fixtures: exact / FTS / fuzzy-top-50', async () => {
  await loadRepoModules();
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  assert.equal(fixtures.warmBudgetP95Ms, WARM_COMMON_QUERY_P95_MS);
  const repo = openRepo();

  for (const c of fixtures.cases) {
    const hits = repo.search(c.query);
    assert.ok(hits.length > 0, `${c.id}: expected hits for "${c.query}"`);
    if (c.expectTopFoodId) {
      assert.equal(
        hits[0].foodId,
        c.expectTopFoodId,
        `${c.id}: top want ${c.expectTopFoodId} got ${hits[0].foodId} (${hits.map((h) => h.foodId).join(',')})`,
      );
    }
    if (c.expectTopFoodIdsAnyOf) {
      assert.ok(
        c.expectTopFoodIdsAnyOf.includes(hits[0].foodId),
        `${c.id}: top ${hits[0].foodId} not in ${c.expectTopFoodIdsAnyOf}`,
      );
    }
    if (c.expectBothPresent) {
      const ids = new Set(hits.map((h) => h.foodId));
      for (const id of c.expectBothPresent) {
        assert.ok(ids.has(id), `${c.id}: missing ${id}`);
      }
    }
    if (c.expectMatchKind) {
      assert.equal(hits[0].matchKind, c.expectMatchKind, `${c.id}: matchKind`);
    }
    assert.ok(hits.length <= 50, `${c.id}: fuzzy pool cap`);
  }
  repo.close();
});

test('sql.js test double: exact match still works without FTS5', async () => {
  await loadRepoModules();
  const { openSeedFileViaSqlJs } = await import(
    pathToFileURL(join(bundleDir, 'openSeedNode.js')).href
  );
  const db = await openSeedFileViaSqlJs(fixtureSeed);
  const repo = new LocalFoodRepository(db);
  const meta = repo.getMetadata();
  assert.equal(meta.ftsAvailable, false);
  const hits = repo.search('banana');
  assert.equal(hits[0].foodId, 'usda-sr-legacy:173944');
  assert.equal(hits[0].matchKind, 'exact');
  // LIKE fallback still finds chicken breast pair
  const chicken = repo.search('chicken breast');
  const ids = chicken.map((h) => h.foodId);
  assert.ok(ids.includes('usda-sr-legacy:171077'));
  assert.ok(ids.includes('usda-sr-legacy:171079'));
  repo.close();
});

test('warm common-query budget documented and met on fixture (Node)', async () => {
  await loadRepoModules();
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const repo = openRepo();
  // Warm-up
  for (const c of fixtures.cases) repo.search(c.query);

  const samples = [];
  const rounds = 25;
  for (let i = 0; i < rounds; i++) {
    for (const c of fixtures.cases) {
      const t0 = performance.now();
      repo.search(c.query);
      samples.push(performance.now() - t0);
    }
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
  assert.ok(
    p95 <= fixtures.warmBudgetP95Ms,
    `warm p95 ${p95.toFixed(2)}ms exceeds budget ${fixtures.warmBudgetP95Ms}ms`,
  );
  repo.close();
});
