// Browser check of the production log sheet through React Native Web.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
await build({
  stdin: { contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { FoodDetailSheet } from './modules/diary/food-detail/FoodDetailSheet';
    const NativeDate = Date, fixed = new Date(2026, 10, 5, 15, 55);
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
      static now() { return fixed.getTime(); }
    };
    const root = createRoot(document.getElementById('root'));
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const pause = () => new Promise(resolve => setTimeout(resolve, 150));
    const model = { kind: 'seed', foodStableId: 'food', displayName: 'Test food',
      brand: null, licenseTag: 'USDA', sourceDisplayName: 'USDA', servings: [],
      defaultUnit: {kind: 'grams'}, customBasis: null, suggestedQuantity: 100,
      nutrients: {energy_kcal: 100, protein: 5, fat_total: 2, carbohydrate: 10} };
    const db = {exec() {}};
    const meal = name => document.querySelector('[aria-label="Meal ' + name + '"]');
    const time = () => document.querySelector('[aria-label="Meal time"]')?.value;
    async function run() {
      let key = 0;
      for (const scheme of ['light', 'dark']) {
        window.smokeScheme = scheme;
        for (const [day, explicit, manual, expectedSlot, expectedTime] of [
          ['2026-11-05', null, null, 'Dinner', '15:55'],
          ['2026-11-04', null, null, 'Dinner', '18:30'],
          ['2026-11-06', null, null, 'Dinner', '18:30'],
          ['2026-11-05', 'breakfast', null, 'Breakfast', '15:55'],
          ['2026-11-04', 'breakfast', null, 'Breakfast', '08:00'],
          ['2026-11-05', null, 'Lunch', 'Lunch', '12:30'],
          ['2026-11-05', 'snacks', null, 'Snacks', '15:55'],
        ]) {
          window.loggedEntry = null;
          root.render(<FoodDetailSheet key={++key} visible model={model} db={db} energyUnit="kcal"
            localDayKey={day} initialMealSlotId={explicit} onClose={()=>{}} onLogged={()=>{}} />);
          await pause(); await pause();
          if (manual) { meal(manual).click(); await pause(); }
          check(meal(expectedSlot) && getComputedStyle(meal(expectedSlot)).backgroundColor !== getComputedStyle(meal(expectedSlot === 'Breakfast' ? 'Dinner' : 'Breakfast')).backgroundColor, 'selected ' + expectedSlot);
          check(time() === expectedTime, 'input time: ' + time());
          const button = [...document.querySelectorAll('[role="button"]')].find(el => el.textContent.startsWith('Log to '));
          check(button && button.getAttribute('aria-disabled') !== 'true', 'Log enabled');
          button.click(); await pause();
          const entry = window.loggedEntry;
          check(entry?.mealSlotId === expectedSlot.toLowerCase(), 'submitted slot: ' + JSON.stringify(entry));
          check(entry.localDayKey === day, 'submitted date');
          const dt = new Date(entry.timestamp);
          const hhmm = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
          check(hhmm === expectedTime && dt.getDate() === Number(day.slice(-2)), 'submitted timestamp');
        }
      }
      document.body.dataset.result = 'PASS';
    }
    run().catch(error => { document.body.dataset.result = 'FAIL'; document.body.append(String(error)); });
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  alias: { 'react-native': 'react-native-web', '@': process.cwd() },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: resolve(out, 'bundle.js'),
  plugins: [{ name: 'smoke-native-context', setup(builder) {
    builder.onResolve({ filter: /^(@\/design-system|react-native-safe-area-context)$/ }, args => ({ path: args.path, namespace: 'smoke' }));
    builder.onLoad({ filter: /.*/, namespace: 'smoke' }, args => ({
      contents: args.path === 'react-native-safe-area-context'
        ? `export { View as SafeAreaView } from 'react-native-web';`
        : `import React from 'react';
          import {Text} from 'react-native-web';
          import {lightPalette, darkPalette, Spacing, Radius, SystemTypography} from './design-system/tokens';
          export {MacroSummary} from './design-system/components/MacroSummary';
          export {PrimaryButton} from './design-system/components/PrimaryButton';
          export {ErrorBanner} from './design-system/components/ErrorBanner';
          export const useTheme = () => ({colors: window.smokeScheme === 'dark' ? darkPalette : lightPalette, spacing: Spacing, radius: Radius, typography: SystemTypography, font: weight => ({fontWeight: weight})});
          export const useReduceMotion = () => true;
          export const modalAnimationFor = () => 'none';`,
      resolveDir: process.cwd(), loader: 'js',
    }));
    // Persistence boundary only: real sheet state, calculations and log handler run.
    builder.onResolve({ filter: /^\.\.\/\.\.\/app-core\/user-data$/ }, () => ({ path: 'store', namespace: 'store' }));
    builder.onLoad({ filter: /.*/, namespace: 'store' }, () => ({ loader: 'js', contents: `
      export const ensureDefaultMealSlots = () => {};
      export const listMealSlots = () => [
        {id: 'breakfast', name: 'Breakfast', defaultTime: '08:00'},
        {id: 'lunch', name: 'Lunch', defaultTime: '12:30'},
        {id: 'dinner', name: 'Dinner', defaultTime: '18:30'},
        {id: 'snacks', name: 'Snacks', defaultTime: null}];
      export const getRecentFood = () => null, isFavorite = () => false;
      export const toggleFavorite = () => ({favorited: false});
      export const createDiaryEntry = (db, entry) => (window.loggedEntry = entry);
      export const getDiaryEntry = () => null, recordRecentFood = () => {};
    ` }));
    // Child design-system components use the same isolated theme context.
    builder.onResolve({ filter: /^\.\.\/theme$/ }, () => ({ path: '@/design-system', namespace: 'smoke' }));
  } }],
});
writeFileSync(resolve(out, 'index.html'), '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root"></div><script src="bundle.js"></script>');

// CDP pipe gives a bounded result without depending on Chrome's dump-dom load wait.
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
  '--headless', '--no-sandbox', '--disable-gpu', '--disable-extensions',
  '--disable-background-networking', '--no-first-run', '--remote-debugging-pipe',
  `--user-data-dir=${resolve(out, 'chrome')}`,
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let sequence = 0, buffer = '';
const pending = new Map();
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send('Page.navigate', { url: pathToFileURL(resolve(out, 'index.html')).href }, sessionId);
  let result;
  for (let attempt = 0; attempt < 100; attempt++) {
    const evaluated = await send('Runtime.evaluate', { expression: 'document.body?.dataset.result', returnByValue: true }, sessionId);
    result = evaluated.result.value;
    if (result) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (result !== 'PASS') {
    const dom = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }, sessionId);
    throw new Error(`Browser smoke ${result}: ${dom.result.value}`);
  }
  console.log('PASS: Chrome at 390x844, light/dark, 15:55 defaults, other dates, explicit/manual slots and submitted timestamps');
} finally {
  chrome.kill();
}
