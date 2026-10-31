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
  assert.equal(isDailyGoalHit({ calories: 901.8, protein: 150 }, { ...goals, calorieGoal: 1002 }), true, 'floating-point lower calorie edge inclusive');
  assert.equal(isDailyGoalHit({ calories: 901.79, protein: 150 }, { ...goals, calorieGoal: 1002 }), false, 'below lower calorie edge');
  assert.equal(isDailyGoalHit({ calories: 1102.2, protein: 150 }, { ...goals, calorieGoal: 1002 }), true, 'upper calorie edge inclusive');
  assert.equal(isDailyGoalHit({ calories: 1102.21, protein: 150 }, { ...goals, calorieGoal: 1002 }), false, 'above upper calorie edge');
  assert.equal(isDailyGoalHit({ calories: 1799, protein: 150 }, goals), false, 'calories too low');
  assert.equal(isDailyGoalHit({ calories: 2201, protein: 150 }, goals), false, 'calories too high');
  assert.equal(isDailyGoalHit({ calories: 2000, protein: 134.9 }, goals), false, 'protein below 90%');
  assert.equal(isDailyGoalHit({ calories: 2000, protein: 93.6 }, { ...goals, proteinGoal: 104 }), true, 'floating-point boundary inclusive');
  assert.equal(isDailyGoalHit({ calories: 2000, protein: 93.5 }, { ...goals, proteinGoal: 104 }), false, 'below floating-point boundary');
  assert.equal(isDailyGoalHit({ calories: 2000, protein: 93.6 }, { ...goals, proteinGoal: 104.1 }), false, 'fractional threshold is not rounded down');
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
  assert.match(today, /\{showGoalHit \? <GoalHitCard reduceMotion=\{reduceMotion\} \/> : null\}/);
  assert.ok(today.indexOf('<GoalHitCard') > today.indexOf('<MacroSummary'), 'below summary');
  assert.ok(today.indexOf('<GoalHitCard') < today.indexOf('view.slots.map'), 'above meal slots');
  assert.match(today, /Platform\.OS !== 'web'/);
  assert.match(today, /Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Success\)\.catch\(/);
  assert.match(today, /isDailyGoalHit\(view\.rawTotals, view\.goals\)/);
  assert.match(today, /claimGoalHitCelebration\(/);
  const card = read('modules/diary/GoalHitCard.tsx');
  assert.match(card, /entering=\{reduceMotion === false \? FadeInDown/);
  assert.match(card, /<Mascot pose="cheer"/);
  assert.doesNotMatch(read('design-system/components/MacroSummary.tsx'), /Mascot|GoalHit/);
});

test('issue 125: Today resolves Reduce Motion before the card mounts', async () => {
  const today = read('app/(tabs)/today.tsx');
  const screen = today.slice(today.indexOf('export default function TodayScreen()'));
  assert.match(screen, /const reduceMotion = useReduceMotion\(\)/);
  assert.ok(screen.indexOf('useReduceMotion()') < screen.indexOf('showGoalHit ? <GoalHitCard'));

  const hook = read('design-system/theme/useReduceMotion.ts');
  const body = hook.slice(hook.indexOf('export function useReduceMotion()')).replace('export function', 'function');
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let state = null, effect, resolveQuery;
  const query = new Promise((resolve) => { resolveQuery = resolve; });
  const run = new Function('useState', 'useEffect', 'AccessibilityInfo', `${js}; return useReduceMotion();`);
  const renderScreen = () => run(() => [state, (value) => { state = value; }], (fn) => { effect ??= fn; }, {
    isReduceMotionEnabled: () => query,
    addEventListener: () => ({ remove() {} }),
  });
  assert.equal(renderScreen(), null);
  const cleanup = effect();
  resolveQuery(false);
  await query;
  assert.equal(renderScreen(), false, 'resolved preference is available when the card subsequently mounts');
  cleanup();
});

test('issue 125: card renders statically until motion is known to be allowed', () => {
  const source = read('modules/diary/GoalHitCard.tsx');
  const body = source.slice(source.indexOf('export function GoalHitCard(')).replace('export function', 'function');
  const js = ts.transpileModule(body, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const render = new Function('React', 'useTheme', 'reduceMotion', 'Animated', 'FadeInDown', 'Card', 'View', 'Mascot', 'Text', `${js}; return GoalHitCard({ reduceMotion });`);
  const run = (motion) => render({ createElement: (type, props) => ({ type, props }) }, () => ({ colors: {}, spacing: {}, typography: {} }), motion, { View: 'animated' }, { duration: (ms) => ms }, 'card', 'view', 'mascot', 'text');
  for (const [motion, entering] of [[null, undefined], [false, 260], [true, undefined]]) {
    const mounted = run(motion);
    assert.equal(mounted.type, 'animated');
    assert.equal(mounted.props.entering, entering, 'entrance is selected on mount');
  }
});

test('issue 125: midnight and foreground update the day and clean up', () => {
  const source = read('app/(tabs)/today.tsx');
  const start = source.indexOf('  useEffect(() => {', source.indexOf('const [todayKey'));
  const end = source.indexOf('  }, []);', start) + '  }, []);'.length;
  const effect = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let now = new Date(2026, 9, 28, 23, 59, 59).getTime();
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  let scheduled, listener, removed = false, day;
  const cleanup = new Function('useEffect', 'setTodayKey', 'localDayKeyFromDate', 'Date', 'setTimeout', 'clearTimeout', 'AppState', `${effect}; return cleanup;`)(
    (fn) => { globalThis.cleanup = fn(); }, (value) => { day = value; }, () => new Date(now).getDate(), FakeDate,
    (fn, delay) => { scheduled = { fn, delay }; return 1; }, () => {},
    { addEventListener: (_event, fn) => { listener = fn; return { remove: () => { removed = true; } }; } },
  );
  delete globalThis.cleanup;
  assert.equal(day, 28);
  assert.equal(scheduled.delay, 1000);
  now += 1000;
  scheduled.fn();
  assert.equal(day, 29);
  now += 86400000;
  listener('active');
  assert.equal(day, 30);
  cleanup();
  assert.equal(removed, true);
});

test('issue 125: claim invokes provider persistence', () => {
  assert.match(read('app/(tabs)/today.tsx'), /if \(fire\) refresh\(\)/);
  assert.match(read('components/UserDataProvider.tsx'), /const refresh = useCallback\([\s\S]*?if \(persistSqlJsRef\.current\) writePersistedSqlJs\(db\)/);
});
