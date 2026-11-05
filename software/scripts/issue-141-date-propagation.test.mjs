import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path) => readFileSync(join(root, path), 'utf8');
let temp, days, store, detail, quick, FoodDetailSheet;
before(async () => {
  temp = mkdtempSync(join(root, '.issue-141-'));
  async function bundle(entry, name, plugins = []) {
    const outfile = join(temp, `${name}.mjs`);
    await build({ entryPoints: [join(root, entry)], outfile, bundle: true,
      platform: 'node', format: 'esm', jsx: 'automatic',
      external: ['react', 'react/jsx-runtime', 'sql.js', 'expo-sqlite', 'node-sqlite3-wasm'], plugins });
    return import(pathToFileURL(outfile).href);
  }
  days = await bundle('modules/diary/dayKey.ts', 'days');
  store = await bundle('modules/app-core/user-data/index.ts', 'store');
  detail = await bundle('modules/diary/food-detail/buildFoodDetail.ts', 'detail');
  quick = await bundle('modules/diary/favorites-recents/quickAdd.ts', 'quick');
  ({ FoodDetailSheet } = await bundle('modules/diary/food-detail/FoodDetailSheet.tsx', 'sheet', [{
    name: 'sheet-ui',
    setup(api) {
      api.onResolve({ filter: /^(react-native|react-native-safe-area-context|@\/design-system)$/ }, ({ path }) => ({ path, namespace: 'ui' }));
      api.onLoad({ filter: /.*/, namespace: 'ui' }, ({ path }) => ({ loader: 'js', contents: path === '@/design-system' ? `
        import React from 'react';
        export const useTheme = () => ({ colors: {}, spacing: {}, typography: {}, radius: {} });
        export const useReduceMotion = () => true;
        export const modalAnimationFor = () => 'none';
        export const MacroSummary = () => null;
        export const ErrorBanner = () => null;
        export function PrimaryButton(props) { globalThis.__issue141Button = props; return React.createElement('button', null, props.label); }
      ` : `
        import React from 'react';
        const Box = ({ children }) => React.createElement('div', null, children);
        export const Modal = Box, View = Box, Text = Box, TextInput = Box, Pressable = Box, ScrollView = Box, SafeAreaView = Box;
        export const Platform = { OS: 'web' }, StyleSheet = { create: x => x, hairlineWidth: 1 };
      ` }));
    },
  }]));
});
after(() => { rmSync(temp, { recursive: true, force: true }); delete globalThis.__issue141Button; });

test('route date validates real calendar days and falls back for missing, malformed or repeated params', () => {
  const today = '2026-10-31';
  for (const invalid of [undefined, '', '2026-2-03', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', 'bad', ['2026-10-30'], '2026-10-30T12:00:00Z']) {
    assert.equal(days.resolveRouteDayKey(invalid, today), today);
  }
  for (const valid of ['2026-10-30', '2026-11-01', '2024-02-29', '2027-01-01']) {
    assert.equal(days.resolveRouteDayKey(valid, today), valid);
  }
  assert.equal(days.formatDayLabel('2026-10-30', today), 'Yesterday');
  assert.equal(days.formatDayLabel('2026-11-01', today), 'Tomorrow');
  assert.equal(days.formatDayLabel(today, today), 'Today');
  assert.match(days.formatDayLabel('2026-10-23', today), /Oct.*23/);
});

test('Today forwards its selected day, Search uses it for sheet/quick-add/return, tab press clears retained params', () => {
  const today = source('app/(tabs)/today.tsx');
  const search = source('app/(tabs)/food-entry.tsx');
  assert.match(today, /useLocalSearchParams/);
  assert.match(today, /const dayKey = resolveRouteDayKey\(date\)/);
  assert.match(today, /onChange=\{\(nextDay\) => router.setParams\(\{ date: nextDay \}\)\}/);
  assert.equal(today.match(/pathname: '\/food-entry', params: \{ date: dayKey \}/g)?.length, 2);
  assert.match(today, /view.entryCount === 0[\s\S]*?<EmptyState[\s\S]*?\) : \([\s\S]*?<PrimaryButton[\s\S]*?date: dayKey/);
  assert.match(search, /const localDayKey = resolveRouteDayKey\(date\)/);
  assert.match(search, /<FoodDetailSheet[\s\S]*?localDayKey=\{localDayKey\}/);
  assert.match(search, /quickAddFood\(userDb, repo, \{[^}]*localDayKey,[^}]*timestamp: timestampFromLocalDayAndTime\(localDayKey, localTimeHHMM\(\)\)/);
  assert.equal(search.match(/pathname: '\/\(tabs\)\/today', params: \{ date: localDayKey \}/g)?.length, 2);
  assert.match(source('app/(tabs)/_layout.tsx'), /tabPress:[\s\S]*?event.preventDefault\(\);\s*navigation.navigate\('food-entry', \{ date: undefined \}\)/);
});

test('real food sheet labels and writes yesterday/tomorrow/other dates; no date still logs today', async () => {
  const db = await store.openSqlJsDatabase();
  store.migrateUserStore(db);
  try {
    const custom = store.createCustomFood(db, { name: 'Date regression food', basisKind: 'serving', basisAmount: 1, basisUnit: 'bowl', gramWeightForBasis: 100,
      nutrients: { energy_kcal: 100, protein: 5, carbohydrate: 10, fat_total: 2 } });
    const model = detail.buildCustomFoodDetail(custom, 'kg');
    const today = days.localDayKeyFromDate();
    for (const param of [days.shiftDayKey(today, -1), days.shiftDayKey(today, 1), days.shiftDayKey(today, -8), undefined]) {
      let logged;
      const day = days.resolveRouteDayKey(param);
      const markup = renderToStaticMarkup(React.createElement(FoodDetailSheet, {
        visible: true, model, db, energyUnit: 'kcal', localDayKey: param,
        onClose() {}, onLogged(id) { logged = id; },
      }));
      assert.ok(markup.includes(`Logs to ${day} at`));
      assert.ok(markup.includes(`Log to ${days.formatDayLabel(day)}`));
      assert.equal(globalThis.__issue141Button.disabled, false);
      globalThis.__issue141Button.onPress();
      assert.ok(logged);
      const entry = store.getDiaryEntry(db, logged);
      assert.equal(entry.localDayKey, day);
      assert.equal(days.localDayKeyFromDate(new Date(entry.timestamp)), day);
      assert.equal(store.listDiaryEntriesForDay(db, day).length, 1);
    }
    assert.equal(store.listDiaryEntriesForDay(db, today).length, 1);
  } finally { db.close(); }
});

test('quick-add to a populated selected day keeps its timestamp on that day', async () => {
  const db = await store.openSqlJsDatabase();
  store.migrateUserStore(db);
  try {
    const custom = store.createCustomFood(db, { name: 'Quick date food', basisKind: 'serving', basisAmount: 1, basisUnit: 'bowl', gramWeightForBasis: 100,
      nutrients: { energy_kcal: 100, protein: 5, carbohydrate: 10, fat_total: 2 } });
    const day = days.shiftDayKey(days.localDayKeyFromDate(), -1);
    for (let i = 0; i < 2; i++) {
      const result = quick.quickAddFood(db, null, { foodKind: 'custom', foodStableId: custom.id, mealSlotId: null, localDayKey: day,
        timestamp: days.timestampFromLocalDayAndTime(day, days.localTimeHHMM()) });
      assert.equal(result.ok, true);
      const entry = store.getDiaryEntry(db, result.entryId);
      assert.equal(entry.localDayKey, day);
      assert.equal(days.localDayKeyFromDate(new Date(entry.timestamp)), day);
    }
    assert.equal(store.listDiaryEntriesForDay(db, day).length, 2);
  } finally { db.close(); }
});
