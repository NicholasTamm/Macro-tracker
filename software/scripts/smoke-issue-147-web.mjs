// Browser check of the production edit sheet through React Native Web.
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
    import { DiaryEntryEditSheet } from './modules/diary/entry-edit/DiaryEntryEditSheet';
    const root = createRoot(document.getElementById('root'));
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const entry = { foodDisplayName: 'Egg', unitLabel: 'g', quantity: 150, grams: 150,
      nutritionSnapshot: { energy_kcal: 200, protein: 15, fat_total: 10, carbohydrate: 2 } };
    async function run() {
      for (const scheme of ['light', 'dark']) {
        window.smokeScheme = scheme;
        for (const [unitLabel, quantity, invalid] of [['g', 150, false], ['egg', 2, false], ['g', 150, true]]) {
          root.render(<DiaryEntryEditSheet key={scheme + unitLabel + quantity + invalid} visible
            entry={{...entry, unitLabel, quantity, nutritionSnapshot: invalid ? null : entry.nutritionSnapshot}} energyUnit="kcal" onClose={()=>{}} onSave={()=>{}} />);
          let body = '';
          for (let attempt = 0; attempt < 50; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            body = document.body.innerText;
            if (body.includes('Unit: ' + unitLabel) && (!invalid || body.includes('Cannot recalculate'))) break;
          }
          check(body.includes('Unit: ' + unitLabel), scheme + ': subtitle missing');
          check(!/snapshot|seed|rewrite/i.test(body), scheme + ': developer text exposed');
          if (invalid) check(body.includes('Unable to calculate nutrients for this entry.'), 'error message');
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
  console.log('PASS: Chrome at 390x844, light/dark, diary edit subtitle and calculation error copy');
} finally {
  chrome.kill();
}
