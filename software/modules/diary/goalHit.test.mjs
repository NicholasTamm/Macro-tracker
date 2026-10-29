import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(here, '../..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');

async function load() {
  const dir = mkdtempSync(join(tmpdir(), 'macro-tracker-goalhit-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    const out = ts.transpileModule(readFileSync(join(here, 'goalHit.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    writeFileSync(join(dir, 'goalHit.js'), out);
    return await import(pathToFileURL(join(dir, 'goalHit.js')).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Minimal app_setting-only SqlExecutor; survives "reloads" by reusing the map. */
function fakeDb(store = new Map()) {
  return {
    store,
    get: (_sql, [key]) => (store.has(key) ? { value: store.get(key) } : undefined),
    run: (_sql, [key, value]) => void store.set(key, value),
  };
}

const goals = { calorieGoal: 2000, proteinGoal: 150 };

test('issue 125: rule = calories within ±10% and protein ≥ 90%', async () => {
  const { isDailyGoalHit } = await load();
  assert.equal(isDailyGoalHit({ calories: 2000, protein: 150 }, goals), true);
  assert.equal(isDailyGoalHit({ calories: 1800, protein: 135 }, goals), true, 'lower edges inclusive');
  assert.equal(isDailyGoalHit({ calories: 2200, protein: 300 }, goals), true, 'upper calorie edge inclusive; protein has no ceiling');
  assert.equal(isDailyGoalHit({ calories: 1799, protein: 150 }, goals), false, 'calories too low');
  assert.equal(isDailyGoalHit({ calories: 2201, protein: 150 }, goals), false, 'calories too high');
  assert.equal(isDailyGoalHit({ calories: 2000, protein: 134.9 }, goals), false, 'protein below 90%');
});

test('issue 125: missing goals and null/invalid totals never hit', async () => {
  const { isDailyGoalHit } = await load();
  const ok = { calories: 2000, protein: 150 };
  for (const g of [undefined, null, {}, { calorieGoal: 2000 }, { proteinGoal: 150 }, { calorieGoal: 0, proteinGoal: 150 }, { calorieGoal: 2000, proteinGoal: NaN }]) {
    assert.equal(isDailyGoalHit(ok, g), false, JSON.stringify(g));
  }
  for (const t of [undefined, null, {}, { calories: null, protein: 150 }, { calories: 2000, protein: null }, { calories: NaN, protein: 150 }]) {
    assert.equal(isDailyGoalHit(t, goals), false, JSON.stringify(t));
  }
});

test('issue 125: card only on the current day', async () => {
  const { shouldShowGoalHitCard } = await load();
  assert.equal(shouldShowGoalHitCard({ viewDayKey: '2026-10-28', todayKey: '2026-10-28', hit: true }), true);
  assert.equal(shouldShowGoalHitCard({ viewDayKey: '2026-10-27', todayKey: '2026-10-28', hit: true }), false, 'past day');
  assert.equal(shouldShowGoalHitCard({ viewDayKey: '2026-10-28', todayKey: '2026-10-28', hit: false }), false, 'after undo/delete drops below');
});

test('issue 125: haptic claim fires once per day across reloads, again next day', async () => {
  const { claimGoalHitCelebration, getCelebratedGoalDay, GOAL_HIT_CELEBRATED_KEY } = await load();
  assert.equal(GOAL_HIT_CELEBRATED_KEY, 'goal_hit_celebrated_day');
  const store = new Map();
  const today = { viewDayKey: '2026-10-28', todayKey: '2026-10-28', hit: true };
  assert.equal(claimGoalHitCelebration(fakeDb(store), today), true);
  assert.equal(getCelebratedGoalDay(fakeDb(store)), '2026-10-28');
  assert.equal(claimGoalHitCelebration(fakeDb(store), today), false, 'reload same day');
  assert.equal(claimGoalHitCelebration(fakeDb(store), { ...today, hit: false }), false);
  assert.equal(claimGoalHitCelebration(fakeDb(store), today), false, 'dip below then re-hit: no repeat');
  assert.equal(claimGoalHitCelebration(fakeDb(store), { viewDayKey: '2026-10-27', todayKey: '2026-10-29', hit: true }), false, 'past day view never claims');
  assert.equal(claimGoalHitCelebration(fakeDb(store), { viewDayKey: '2026-10-29', todayKey: '2026-10-29', hit: true }), true, 'next day');
});

test('issue 125: Today wiring — card outside MacroSummary, guarded haptic, reduce-motion static', () => {
  const today = read('app/(tabs)/today.tsx');
  assert.match(today, /\{showGoalHit \? <GoalHitCard \/> : null\}/);
  assert.ok(today.indexOf('<GoalHitCard') > today.indexOf('<MacroSummary'), 'below summary');
  assert.ok(today.indexOf('<GoalHitCard') < today.indexOf('view.slots.map'), 'above meal slots');
  assert.match(today, /Platform\.OS !== 'web'/);
  assert.match(today, /Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Success\)\.catch\(/);
  assert.match(today, /claimGoalHitCelebration\(/);
  const card = read('modules/diary/GoalHitCard.tsx');
  assert.match(card, /entering=\{reduceMotion === false \? FadeInDown/);
  assert.match(card, /<Mascot pose="cheer"/);
  assert.doesNotMatch(read('design-system/components/MacroSummary.tsx'), /Mascot|GoalHit/);
});
