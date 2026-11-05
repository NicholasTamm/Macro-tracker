import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

let temp, defaultMealForLog;
const here = dirname(fileURLToPath(import.meta.url));
const slots = [
  { id: 'breakfast', defaultTime: '08:00' },
  { id: 'lunch', defaultTime: '12:30' },
  { id: 'dinner', defaultTime: '18:30' },
  { id: 'snacks', defaultTime: null },
];
const nowAt = (time) => new Date(`2026-11-05T${time}:00`);
before(async () => {
  temp = mkdtempSync(join(here, '.default-meal-'));
  const outfile = join(temp, 'defaultMeal.mjs');
  await build({ entryPoints: [join(here, 'defaultMeal.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
  ({ defaultMealForLog } = await import(pathToFileURL(outfile).href));
});
after(() => rmSync(temp, { recursive: true, force: true }));

test('nearest local meal boundaries, later-slot ties, and no midnight wrap', () => {
  for (const [time, mealSlotId] of [
    ['00:00', 'breakfast'], ['08:00', 'breakfast'], ['10:14', 'breakfast'],
    ['10:15', 'lunch'], ['10:16', 'lunch'], ['12:30', 'lunch'],
    ['15:29', 'lunch'], ['15:30', 'dinner'], ['15:31', 'dinner'],
    ['15:55', 'dinner'], ['18:30', 'dinner'], ['23:59', 'dinner'],
  ]) {
    assert.deepEqual(defaultMealForLog(slots, '2026-11-05', null, nowAt(time)), { mealSlotId, timeText: time });
  }
});

test('other days use the same current-clock meal with its default time', () => {
  for (const day of ['2026-11-04', '2026-11-06']) {
    assert.deepEqual(defaultMealForLog(slots, day, null, nowAt('15:55')), { mealSlotId: 'dinner', timeText: '18:30' });
    assert.deepEqual(defaultMealForLog(slots, day, 'breakfast', nowAt('15:55')), { mealSlotId: 'breakfast', timeText: '08:00' });
  }
});

test('explicit slots win, including untimed slots; today still uses now', () => {
  for (const mealSlotId of ['breakfast', 'lunch', 'snacks']) {
    assert.deepEqual(defaultMealForLog(slots, '2026-11-05', mealSlotId, nowAt('15:55')), { mealSlotId, timeText: '15:55' });
  }
  assert.deepEqual(defaultMealForLog(slots, '2026-11-04', 'snacks', nowAt('15:55')), { mealSlotId: 'snacks', timeText: '15:55' });
});

test('custom times and unsorted slots work; empty/untimed lists and stale ids are safe', () => {
  const custom = [{ id: 'late', defaultTime: '22:00' }, { id: 'early', defaultTime: '06:00' }];
  assert.equal(defaultMealForLog(custom, '2026-11-05', null, nowAt('14:00')).mealSlotId, 'late');
  assert.equal(defaultMealForLog(slots, '2026-11-05', 'archived', nowAt('15:55')).mealSlotId, 'dinner');
  assert.deepEqual(defaultMealForLog([], '2026-11-04', null, nowAt('15:55')), { mealSlotId: null, timeText: '15:55' });
  assert.deepEqual(defaultMealForLog([slots[3]], '2026-11-04', null, nowAt('15:55')), { mealSlotId: 'snacks', timeText: '15:55' });
});
