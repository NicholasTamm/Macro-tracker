/**
 * M1-17 Weight sample CRUD + 30-day chart summary.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const bundleDir = join(__dirname, '.bundle');

let userData;
let weight;

before(async () => {
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
        '--external:node-sqlite3-wasm',
      ],
      { cwd: softwareRoot, stdio: 'pipe' },
    );
  }
  bundle(join(softwareRoot, 'modules/app-core/user-data/index.ts'), 'userData.js');
  bundle(join(__dirname, 'index.ts'), 'weight.js');
  userData = await import(pathToFileURL(join(bundleDir, 'userData.js')).href);
  weight = await import(pathToFileURL(join(bundleDir, 'weight.js')).href);
});

async function freshDb() {
  const db = await userData.openSqlJsDatabase();
  userData.migrateUserStore(db);
  return db;
}

const NOW = new Date('2026-10-06T12:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

test('kg/lb round-trip within tolerance', () => {
  for (const lb of [100, 160.4, 199.9, 250.2, 333.3]) {
    const p = weight.parseWeightInput(String(lb), 'lb');
    assert.ok(p.ok);
    assert.equal(weight.toDisplayWeight(p.kilograms, 'lb'), lb);
    assert.ok(Math.abs(userData.kgToLb(p.kilograms) - lb) < 1e-9);
  }
  for (const kg of [45.5, 72.4, 120.1]) {
    const p = weight.parseWeightInput(String(kg), 'kg');
    assert.ok(p.ok);
    assert.equal(p.kilograms, kg);
    // kg → lb display → back to kg stays within 0.05 kg (1-decimal lb display).
    const lb = weight.toDisplayWeight(kg, 'lb');
    assert.ok(Math.abs(weight.fromDisplayWeight(lb, 'lb') - kg) < 0.05);
  }
  assert.equal(weight.formatWeight(72.4, 'kg'), '72.4 kg');
  assert.equal(weight.formatWeight(userData.lbToKg(160.4), 'lb'), '160.4 lb');
});

test('parseWeightInput rejects empty, non-numeric, implausible; accepts comma decimal', () => {
  assert.equal(weight.parseWeightInput('', 'kg').ok, false);
  assert.equal(weight.parseWeightInput('abc', 'kg').ok, false);
  assert.equal(weight.parseWeightInput('-5', 'kg').ok, false);
  assert.equal(weight.parseWeightInput('7240', 'kg').ok, false);
  assert.equal(weight.parseWeightInput('5', 'lb').ok, false);
  const c = weight.parseWeightInput('72,4', 'kg');
  assert.ok(c.ok);
  assert.equal(c.kilograms, 72.4);
});

test('create / edit / tombstone; deleted excluded from chart and summary', async () => {
  const db = await freshDb();
  const a = userData.createWeightSample(db, { timestamp: daysAgo(10), kilograms: 80 });
  const b = userData.createWeightSample(db, { timestamp: daysAgo(5), kilograms: 79 });
  const c = userData.createWeightSample(db, { timestamp: daysAgo(1), kilograms: 78 });

  const edited = userData.updateWeightSample(db, b.id, { kilograms: 79.5 });
  assert.equal(edited.kilograms, 79.5);
  assert.equal(edited.syncRevision, b.syncRevision + 1);
  assert.throws(() => userData.updateWeightSample(db, b.id, { kilograms: 0 }));

  userData.tombstoneWeightSample(db, a.id);
  assert.equal(userData.getWeightSample(db, a.id), null);
  assert.ok(userData.getWeightSample(db, a.id, { includeDeleted: true }).deletedAt);
  assert.equal(userData.updateWeightSample(db, a.id, { kilograms: 70 }), null, 'cannot edit tombstone');

  const live = userData.listWeightSamples(db);
  assert.deepEqual(live.map((s) => s.id), [b.id, c.id]);

  // Even if tombstones are passed in, helpers exclude them.
  const all = userData.listWeightSamples(db, { includeDeleted: true });
  const w = weight.windowSamples(all, NOW);
  assert.deepEqual(w.map((s) => s.id), [b.id, c.id]);
  const sum = weight.summarizeWeights(w);
  assert.equal(sum.count, 2);
  assert.equal(sum.maxKg, 79.5);
  assert.equal(sum.minKg, 78);
  assert.equal(weight.chartPoints(w, NOW).length, 2);
  db.close();
});

test('30-day window excludes older and future samples', async () => {
  const db = await freshDb();
  userData.createWeightSample(db, { timestamp: daysAgo(31), kilograms: 90 });
  const inside = userData.createWeightSample(db, { timestamp: daysAgo(29), kilograms: 85 });
  userData.createWeightSample(db, { timestamp: daysAgo(-1), kilograms: 84 });
  const w = weight.windowSamples(userData.listWeightSamples(db), NOW);
  assert.deepEqual(w.map((s) => s.id), [inside.id]);
  db.close();
});

test('empty and sparse states have sensible copy', () => {
  const empty = weight.summarizeWeights([]);
  assert.equal(empty.state, 'empty');
  assert.match(weight.weightSummaryText(empty, 'kg'), /No weights logged in the last 30 days/);
  assert.deepEqual(weight.chartPoints([], NOW), []);

  const mk = (id, d, kg) => ({ id, timestamp: daysAgo(d), kilograms: kg, deletedAt: null });
  const one = weight.summarizeWeights([mk('a', 3, 72)]);
  assert.equal(one.state, 'sparse');
  assert.equal(one.changeKg, null);
  assert.match(weight.weightSummaryText(one, 'kg'), /^1 weight in the last 30 days: 72\.0 kg\. Log another/);
  const pts = weight.chartPoints([mk('a', 3, 72)], NOW);
  assert.equal(pts[0].y, 0.5);

  const two = weight.summarizeWeights([mk('a', 3, 72), mk('b', 1, 71.5)]);
  assert.equal(two.state, 'sparse');
  const t2 = weight.weightSummaryText(two, 'kg');
  assert.match(t2, /2 weights in the last 30 days\. Latest 71\.5 kg\./);
  assert.match(t2, /Change down 0\.5 kg\./);
  assert.match(t2, /Log more weights for a clearer trend/);
});

test('full summary text: min/max/latest/change/count in preferred unit', () => {
  const mk = (id, d, kg) => ({ id, timestamp: daysAgo(d), kilograms: kg, deletedAt: null });
  const w = weight.windowSamples([mk('c', 1, 81), mk('a', 20, 80), mk('b', 10, 82)], NOW);
  assert.deepEqual(w.map((s) => s.id), ['a', 'b', 'c']);
  const s = weight.summarizeWeights(w);
  assert.equal(s.state, 'full');
  const kgText = weight.weightSummaryText(s, 'kg');
  assert.equal(
    kgText,
    '3 weights in the last 30 days. Latest 81.0 kg. Lowest 80.0 kg, highest 82.0 kg. Change up 1.0 kg.',
  );
  const lbText = weight.weightSummaryText(s, 'lb');
  assert.match(lbText, /Latest 178\.6 lb/);
  assert.match(lbText, /Change up 2\.2 lb/);
  const pts = weight.chartPoints(w, NOW);
  assert.equal(pts[0].y, 0);
  assert.equal(pts[1].y, 1);
  assert.ok(pts[0].x < pts[1].x && pts[1].x < pts[2].x);
});

test('chart exposes accessible text summary; analytics screen wires CRUD', () => {
  const chart = readFileSync(join(__dirname, 'WeightChart.tsx'), 'utf8');
  assert.match(chart, /accessibilityRole="image"/);
  assert.match(chart, /accessibilityLabel=\{`Weight chart, last 30 days\. \$\{summaryText\}`\}/);
  const screen = readFileSync(join(softwareRoot, 'app/(tabs)/analytics.tsx'), 'utf8');
  for (const sym of ['createWeightSample', 'updateWeightSample', 'tombstoneWeightSample', 'weightSummaryText']) {
    assert.ok(screen.includes(sym), `analytics.tsx missing ${sym}`);
  }
});
