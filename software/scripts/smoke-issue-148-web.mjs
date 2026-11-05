// Render production EmptyState and Mascot through RN Web with real placeholder art.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
const entry = readFileSync('app/(tabs)/food-entry.tsx', 'utf8');
const block = entry.slice(entry.indexOf('showEmptyResults ? (')).match(/<EmptyState[\s\S]*?\/>/)[0];
await build({
  stdin: { contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { EmptyState } from './design-system/components/EmptyState';
    import { lightPalette, darkPalette } from './design-system/tokens';
    const root = createRoot(document.getElementById('root'));
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    async function run() {
      for (const scheme of ['light', 'dark']) {
        window.smokeScheme = scheme;
        document.body.style.backgroundColor = (scheme === 'dark' ? darkPalette : lightPalette).canvas;
        root.render(${block});
        let mascot, image;
        for (let attempt = 0; attempt < 50; attempt++) {
          await pause();
          mascot = document.querySelector('[data-testid="mascot-think"]');
          image = mascot?.querySelector('img');
          if (image?.complete && image.naturalWidth > 0) break;
        }
        check(image?.complete && image.naturalWidth > 0, scheme + ': mascot image must load');
        check(mascot.getBoundingClientRect().width === 96 && mascot.getBoundingClientRect().height === 96, scheme + ': 96px mascot');
        check(document.body.innerText.includes('No matching foods'), 'title');
        check(document.body.innerText.includes('Try another search. Packaged online search is not available offline.'), 'message');
        check(!document.body.innerText.includes('📋'), 'no clipboard');
        root.render(<EmptyState title="Text only" />);
        await pause();
        check(!document.querySelector('img') && !document.querySelector('[data-testid="mascot-think"]'), 'fallback has no art');
      }
      document.body.dataset.result = 'PASS';
    }
    run().catch(error => { document.body.dataset.result = 'FAIL'; document.body.append(String(error)); });
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  alias: { 'react-native': 'react-native-web' },
  loader: { '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', 'process.env': '{}' },
  outfile: resolve(out, 'bundle.js'),
  plugins: [{ name: 'smoke-theme', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/theme$/ }, () => ({ path: 'theme', namespace: 'smoke' }));
    builder.onLoad({ filter: /.*/, namespace: 'smoke' }, () => ({
      contents: `import {lightPalette, darkPalette, Spacing, Radius, SystemTypography} from './design-system/tokens';
        export const useTheme = () => ({colors: window.smokeScheme === 'dark' ? darkPalette : lightPalette,
          spacing: Spacing, radius: Radius, typography: SystemTypography, font: weight => ({fontWeight: weight})});`,
      resolveDir: process.cwd(), loader: 'js',
    }));
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
    if (message.method === 'Runtime.exceptionThrown') console.error(JSON.stringify(message.params.exceptionDetails));
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
  await send('Runtime.enable', {}, sessionId);
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
  console.log('PASS: Chrome at 390x844, light/dark, no-results think mascot loaded at 96px and text-only fallback');
} finally {
  chrome.kill();
}
