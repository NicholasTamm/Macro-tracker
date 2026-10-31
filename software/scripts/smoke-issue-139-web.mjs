// Bundle the real MacroSummary + RN Web; isolate only the app's native theme provider.
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
    import { flushSync } from 'react-dom';
    import { MacroSummary } from './design-system/components/MacroSummary';
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const root = createRoot(document.getElementById('root'));
    try {
      for (const scheme of ['light', 'dark']) {
        window.smokeScheme = scheme;
        flushSync(() => root.render(<MacroSummary totals={{calories:0,calorieGoal:2000,protein:50,proteinGoal:100,fat:80,fatGoal:80,carbs:366,carbsGoal:230}} />));
        const cells = [...document.querySelectorAll('[aria-label]')];
        check(cells.length === 4, 'four accessible cells');
        cells.forEach((cell, i) => {
          const track = cell.lastElementChild, fill = track.firstElementChild;
          const innerWidth = track.clientWidth;
          const ratio = fill.getBoundingClientRect().width / innerWidth;
          check(Math.abs(ratio - [0,.5,1,1][i]) < .025, scheme + ': rendered fill ratio ' + ratio);
          check(cell.getAttribute('aria-label').includes([0,50,100,159][i] + '% of target'), 'accessible percentage');
          check(cell.textContent.includes('Over target') === (i === 3), 'non-colour over state');
          check(cell.scrollWidth <= cell.clientWidth + 1, 'cell overflow');
        });
        const bottoms = cells.map(cell => cell.lastElementChild.getBoundingClientRect().bottom);
        check(Math.max(...bottoms) - Math.min(...bottoms) < 1, 'bars align');
        check(document.documentElement.scrollWidth <= innerWidth, '390px viewport overflow');
      }
      document.body.dataset.result = 'PASS';
    } catch (error) { document.body.dataset.result = 'FAIL'; document.body.append(String(error)); }
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  alias: { 'react-native': 'react-native-web', '@': process.cwd() },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: resolve(out, 'bundle.js'),
  plugins: [{ name: 'smoke-theme', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/theme$/ }, () => ({ path: 'theme', namespace: 'smoke' }));
    builder.onLoad({ filter: /.*/, namespace: 'smoke' }, () => ({
      contents: `import {lightPalette, darkPalette, Spacing, Radius, SystemTypography} from './design-system/tokens';
      export const useTheme = () => ({colors: window.smokeScheme === 'dark' ? darkPalette : lightPalette, spacing: Spacing, radius: Radius, typography: SystemTypography, font: weight => ({fontWeight: weight})});`,
      resolveDir: process.cwd(), loader: 'js',
    }));
  } }],
});
writeFileSync(resolve(out, 'index.html'), '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root" style="width:390px"></div><script src="bundle.js"></script>');

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
  console.log('PASS: Chrome at 390x844, light/dark, rendered macro progress and over-target accessibility');
} finally {
  chrome.kill();
}
