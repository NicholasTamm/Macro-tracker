import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');
const analytics = read('app/(tabs)/analytics.tsx');

test('issue 124: scale mascot only when there are zero weigh-ins', () => {
  const start = analytics.indexOf("summary.state === 'empty' ? (");
  assert.ok(start >= 0);
  const block = analytics.slice(analytics.indexOf('<EmptyState', start), analytics.indexOf('/>', start));
  assert.match(block, /mascotPose=\{samples\.length === 0 \? 'scale' : undefined\}/);
  assert.match(block, /title=\{samples\.length === 0 \? 'No weights yet' : 'No recent weights'\}/);
  assert.equal((analytics.match(/mascotPose=/g) ?? []).length, 1, 'no other analytics art');
});

test('issue 124: chart, summary text and units unchanged; chart has no art', () => {
  assert.match(analytics, /<WeightChart\s+points=\{points\}\s+summaryText=\{summaryText\}/);
  assert.match(analytics, /formatWeight\(summary\.minKg, unit\)/);
  assert.doesNotMatch(read('modules/app-core/weight/WeightChart.tsx'), /Mascot|mascot|illustration/);
});
