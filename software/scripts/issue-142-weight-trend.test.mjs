import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = join(root, 'scripts/.bundle/issue-142');
let weight;
let userData;
before(async () => {
  mkdirSync(bundleDir, { recursive: true });
  for (const [name, source] of [
    ['weight', 'modules/app-core/weight/index.ts'],
    ['userData', 'modules/app-core/user-data/index.ts'],
  ]) {
    const outfile = join(bundleDir, `${name}.mjs`);
    await build({ entryPoints: [join(root, source)], outfile, bundle: true,
      platform: 'node', format: 'esm', packages: 'external' });
    const module = await import(pathToFileURL(outfile).href);
    if (name === 'weight') weight = module;
    else userData = module;
  }
});

const now = new Date(2026, 10, 4, 12);
const sample = (id, date, kilograms = 80) => ({
  id, timestamp: `${date}T12:00:00.000Z`, kilograms, deletedAt: null,
});
const summaryFor = (samples) => weight.summarizeWeights(weight.windowSamples(samples, now));

test('issue 142: zero and one in-range weigh-ins hide the chart; two and three show it', () => {
  const samples = [sample('a', '2026-11-01'), sample('b', '2026-11-02', 79.5), sample('c', '2026-11-03', 79)];
  for (const count of [0, 1, 2, 3]) {
    assert.equal(weight.hasWeightTrend(summaryFor(samples.slice(0, count))), count >= 2, `count ${count}`);
  }
  assert.equal(weight.hasWeightTrend(summaryFor([
    samples[0], sample('old', '2026-09-01'), sample('future', '2026-12-01'),
    { ...samples[1], deletedAt: '2026-11-03T12:00:00.000Z' },
  ])), false, 'only live samples inside the range count toward a trend');
  const one = summaryFor([samples[0]]);
  assert.equal(weight.weightSummaryText(one, 'kg'), 'Starting weight 80.0 kg. Log another weigh-in to see your trend.');
  assert.equal(weight.weightSummaryText(one, 'lb'), 'Starting weight 176.4 lb. Log another weigh-in to see your trend.');
});

test('issue 142: real onboarding seed survives starter -> chart -> starter -> empty transitions', async () => {
  const db = await userData.openSqlJsDatabase();
  try {
    userData.migrateUserStore(db);
    userData.saveBiometrics(db, { sex: 'female', birthYear: 1994, heightCm: 165, weightKg: 80 });
    const summarize = () => weight.summarizeWeights(weight.windowSamples(userData.listWeightSamples(db), new Date()));
    const seeded = userData.listWeightSamples(db);
    assert.equal(seeded.length, 1);
    assert.equal(weight.hasWeightTrend(summarize()), false);
    assert.match(weight.weightSummaryText(summarize(), 'kg'), /^Starting weight 80\.0 kg\./);
    const second = userData.createWeightSample(db, { timestamp: seeded[0].timestamp, kilograms: 79.5 });
    assert.equal(weight.hasWeightTrend(summarize()), true);
    userData.tombstoneWeightSample(db, second.id);
    assert.equal(weight.hasWeightTrend(summarize()), false);
    assert.equal(userData.listWeightSamples(db).length, 1, 'seed remains editable/deletable');
    userData.tombstoneWeightSample(db, seeded[0].id);
    assert.equal(summarize().state, 'empty');
    assert.equal(weight.hasWeightTrend(summarize()), false);
  } finally {
    db.close();
  }
});

test('issue 142: screen gates chart with the tested threshold and leaves entries outside it', () => {
  const screen = readFileSync(join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
  const start = screen.indexOf('!hasWeightTrend(summary) ? (');
  const chart = screen.indexOf('<WeightChart', start);
  const entries = screen.indexOf('{newestFirst.length > 0 ? (', chart);
  assert.ok(start > 0 && chart > start && entries > chart);
  assert.match(screen.slice(start, chart), /<EmptyState/);
  assert.match(screen.slice(start, chart), /'No weights yet'/);
  assert.match(screen.slice(entries), /onEdit\(s\)/);
  assert.match(screen.slice(entries), /onDelete\(s\)/);
  assert.doesNotMatch(readFileSync(join(root, 'modules/app-core/weight/WeightChart.tsx'), 'utf8'), /Mascot|mascot|illustration/);
});
