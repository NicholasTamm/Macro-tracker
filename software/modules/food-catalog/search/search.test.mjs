import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const searchDir = __dirname;
const repoDir = join(softwareRoot, 'modules/food-catalog/local-food-repo');
const bundleDir = join(searchDir, '.bundle');

mkdirSync(bundleDir, { recursive: true });
writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));

const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');

function bundle(entry, outfile, external = []) {
  execFileSync(
    esbuildBin,
    [
      entry,
      '--bundle',
      '--platform=node',
      '--format=esm',
      `--outfile=${outfile}`,
      ...external.map((e) => `--external:${e}`),
    ],
    { stdio: 'pipe' },
  );
}

bundle(join(repoDir, 'openSeedNode.ts'), join(bundleDir, 'openSeedNode.js'), [
  'sql.js',
  'node-sqlite3-wasm',
]);
bundle(join(repoDir, 'LocalFoodRepository.ts'), join(bundleDir, 'LocalFoodRepository.js'));
bundle(join(searchDir, 'formatResultDetail.ts'), join(bundleDir, 'formatResultDetail.js'));
bundle(join(searchDir, 'debounce.ts'), join(bundleDir, 'debounce.js'));
bundle(join(searchDir, 'a11ySummary.ts'), join(bundleDir, 'a11ySummary.js'));
bundle(join(searchDir, 'enrichHits.ts'), join(bundleDir, 'enrichHits.js'));
bundle(join(searchDir, 'searchController.ts'), join(bundleDir, 'searchController.js'));
bundle(join(searchDir, 'browseSections.ts'), join(bundleDir, 'browseSections.js'));

const { openSeedFile } = await import(pathToFileURL(join(bundleDir, 'openSeedNode.js')).href);
const { LocalFoodRepository } = await import(
  pathToFileURL(join(bundleDir, 'LocalFoodRepository.js')).href
);
const { formatResultDetail, macrosFromNutrientRows } = await import(
  pathToFileURL(join(bundleDir, 'formatResultDetail.js')).href
);
const { createDebouncedRunner } = await import(
  pathToFileURL(join(bundleDir, 'debounce.js')).href
);
const { formatSearchA11ySummary } = await import(
  pathToFileURL(join(bundleDir, 'a11ySummary.js')).href
);
const { enrichSearchHits } = await import(pathToFileURL(join(bundleDir, 'enrichHits.js')).href);
const { createSearchController } = await import(
  pathToFileURL(join(bundleDir, 'searchController.js')).href
);
const { buildBrowseSections } = await import(
  pathToFileURL(join(bundleDir, 'browseSections.js')).href
);

const fixtures = JSON.parse(
  readFileSync(join(repoDir, 'ranking-fixtures.json'), 'utf8'),
);
const seedPath = join(softwareRoot, fixtures.seedAsset);

function openRepo() {
  const db = openSeedFile(seedPath);
  return new LocalFoodRepository(db);
}

test('formatResultDetail includes source and per-100 g macros', () => {
  const detail = formatResultDetail('USDA SR Legacy', {
    energyKcal: 89,
    proteinG: 1.1,
    fatG: 0.3,
    carbG: 23,
  });
  assert.match(detail, /USDA SR Legacy/);
  assert.match(detail, /89 Cal/);
  assert.match(detail, /1P|1\.1P/);
  assert.match(detail, /per 100 g/);
});

test('macrosFromNutrientRows maps canonical IDs', () => {
  const m = macrosFromNutrientRows([
    { nutrientId: 'energy_kcal', amountPer100g: 89 },
    { nutrientId: 'protein', amountPer100g: 1.1 },
    { nutrientId: 'fat_total', amountPer100g: 0.3 },
    { nutrientId: 'carbohydrate', amountPer100g: 22.8 },
  ]);
  assert.equal(m.energyKcal, 89);
  assert.equal(m.proteinG, 1.1);
});

test('a11y summary covers browse / zero / plural', () => {
  assert.equal(
    formatSearchA11ySummary({ query: '', resultCount: 0, browsing: true }),
    'Browse Recent, Favorites, and My Foods',
  );
  assert.equal(
    formatSearchA11ySummary({ query: 'banana', resultCount: 0 }),
    'No results for banana',
  );
  assert.equal(
    formatSearchA11ySummary({ query: 'rice', resultCount: 1 }),
    '1 result for rice',
  );
  assert.equal(
    formatSearchA11ySummary({ query: 'chicken', resultCount: 2 }),
    '2 results for chicken',
  );
});

test('debounce schedules once; cancel drops pending', async () => {
  const calls = [];
  const timers = new Map();
  let nextId = 1;
  const runner = createDebouncedRunner(
    (gen, q) => {
      calls.push({ gen, q });
    },
    {
      delayMs: 50,
      setTimer: (fn, ms) => {
        const id = nextId++;
        const handle = setTimeout(fn, ms);
        timers.set(id, handle);
        return id;
      },
      clearTimer: (id) => {
        const handle = timers.get(id);
        if (handle) clearTimeout(handle);
        timers.delete(id);
      },
    },
  );

  runner.schedule('a');
  runner.schedule('ab');
  runner.schedule('abc');
  assert.equal(runner.isPending(), true);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].q, 'abc');

  runner.schedule('x');
  runner.cancel();
  assert.equal(runner.isPending(), false);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(calls.length, 1);
});

test('enrichHits exposes source label and per-100 g detail', () => {
  const repo = openRepo();
  try {
    const hits = repo.search('banana');
    assert.ok(hits.length >= 1);
    const enriched = enrichSearchHits(repo, hits);
    assert.match(enriched[0].detail, /per 100 g/);
    assert.match(enriched[0].sourceLabel, /USDA/i);
    assert.ok(enriched[0].detail.includes(enriched[0].sourceLabel));
    assert.ok(enriched[0].macros.energyKcal != null);
  } finally {
    repo.close();
  }
});

test('searchController debounce + cancel returns to browsing', async () => {
  const repo = openRepo();
  const events = [];
  try {
    const controller = createSearchController(
      repo,
      {
        onResults: (q, results) => events.push({ type: 'results', q, n: results.length }),
        onBrowsing: () => events.push({ type: 'browsing' }),
      },
      { debounceMs: 40 },
    );

    controller.setQuery('ban');
    controller.setQuery('banana');
    await new Promise((r) => setTimeout(r, 90));
    assert.ok(events.some((e) => e.type === 'results' && e.q === 'banana' && e.n >= 1));

    controller.setQuery('chick');
    controller.cancel();
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(events.at(-1)?.type, 'browsing');
    assert.equal(controller.isPending(), false);

    controller.setQuery('');
    assert.equal(events.at(-1)?.type, 'browsing');

    controller.dispose();
  } finally {
    repo.close();
  }
});

test('ranking fixtures still hold after enrich (source/per-100g)', () => {
  const repo = openRepo();
  try {
    for (const c of fixtures.cases) {
      const hits = repo.search(c.query);
      assert.ok(hits.length > 0, `no hits for ${c.query}`);
      const top = hits[0].foodId;
      if (c.expectTopFoodId) {
        assert.equal(top, c.expectTopFoodId, `top for ${c.query}`);
      } else if (c.expectTopFoodIdsAnyOf) {
        assert.ok(
          c.expectTopFoodIdsAnyOf.includes(top),
          `top ${top} for ${c.query} not in ${c.expectTopFoodIdsAnyOf}`,
        );
      }
      if (c.expectBothPresent) {
        const ids = new Set(hits.map((h) => h.foodId));
        for (const id of c.expectBothPresent) {
          assert.ok(ids.has(id), `missing ${id} for ${c.query}`);
        }
      }
      const enriched = enrichSearchHits(repo, hits.slice(0, 3));
      for (const row of enriched) {
        assert.match(row.detail, /per 100 g/);
        assert.ok(row.sourceLabel.length > 0);
      }
    }
  } finally {
    repo.close();
  }
});

test('browseSections assembles Recent / Favorites / My Foods', () => {
  const sections = buildBrowseSections({
    recent: [
      {
        foodKind: 'seed',
        foodStableId: 'usda-sr-legacy:173944',
        foodDisplayName: 'Bananas, raw',
        foodLicenseTag: 'CC0-1.0',
      },
    ],
    favorites: [
      {
        foodKind: 'custom',
        foodStableId: 'cf-1',
        foodDisplayName: 'Protein shake',
        foodLicenseTag: 'user',
      },
    ],
    myFoods: [
      {
        id: 'cf-1',
        name: 'Protein shake',
        brand: 'Home',
        nutrients: { energy_kcal: 200, protein: 25, fat_total: 3, carbohydrate: 10 },
      },
    ],
  });
  assert.deepEqual(
    sections.map((s) => s.id),
    ['recent', 'favorites', 'my_foods'],
  );
  assert.equal(sections[0].items[0].name, 'Bananas, raw');
  assert.equal(sections[1].items[0].name, 'Protein shake');
  assert.match(sections[2].items[0].detail, /My Foods/);
  assert.match(sections[2].items[0].detail, /per 100 g/);
});
