import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');
const today = read('app/(tabs)/today.tsx');
const entry = read('app/(tabs)/food-entry.tsx');

function emptyStateBlock(src, after) {
  const i = src.indexOf(after);
  assert.ok(i >= 0, after);
  const start = src.indexOf('<EmptyState', i);
  return src.slice(start, src.indexOf('/>', start));
}

test('issue 123: empty Today shows emptyPlate mascot with a brand Log food CTA to search', () => {
  const block = emptyStateBlock(today, 'view.entryCount === 0 ?');
  assert.match(block, /mascotPose="emptyPlate"/);
  assert.match(block, /actionLabel="Log food"/);
  assert.match(block, /actionVariant="brand"/);
  assert.match(block, /onAction=\{\(\) => router\.push\('\/food-entry'\)\}/);
  assert.match(today, /import \{ router \} from 'expo-router'/);
  assert.match(today, /\{view\.entryCount === 0 \? \(/, 'only rendered while the day has no entries');
});

test('issue 123: empty browse in Food Entry uses think; no-results stays plain', () => {
  assert.match(emptyStateBlock(entry, 'showEmptyBrowse ? ('), /mascotPose="think"/);
  const noResults = emptyStateBlock(entry, 'showEmptyResults ? (');
  assert.doesNotMatch(noResults, /mascotPose|illustration/);
});

test('issue 123: data zones stay art-free', () => {
  const slotStart = today.indexOf('function MealSlotCard');
  assert.ok(slotStart >= 0);
  const slot = today.slice(slotStart, today.indexOf('\nfunction ', slotStart + 10));
  assert.doesNotMatch(slot, /Mascot|mascotPose|illustration/);
  assert.match(today, /emptyHint="No entries in this slot yet\."/, 'slot hint stays plain text');
  assert.doesNotMatch(read('design-system/components/MacroSummary.tsx'), /Mascot|mascot/);
});

test('issue 123: empty-state copy is encouraging, no guilt language', () => {
  const copy = [emptyStateBlock(today, 'view.entryCount === 0 ?'), emptyStateBlock(entry, 'showEmptyBrowse ? (')].join('\n');
  assert.doesNotMatch(copy, /\b(forgot|forget|missed|failed|fail|should|behind|bad|cheat|guilt|empty\.)/i);
});
