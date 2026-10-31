import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url).pathname;
async function bundle(entry, platform) {
  const result = await build({
    entryPoints: [root + entry], bundle: true, platform: 'node', format: 'cjs',
    write: false, external: ['react', 'sql.js'],
    plugins: [{ name: 'startup-platform', setup(b) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'platform', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
        contents: `export const Platform = { OS: ${JSON.stringify(platform)} };`,
      }));
      b.onResolve({ filter: /^expo-sqlite$/ }, () => ({ path: 'sqlite', namespace: 'sqlite' }));
      b.onLoad({ filter: /.*/, namespace: 'sqlite' }, () => ({ contents: `
        globalThis.startupCalls.loaded = true;
        export function openDatabaseSync(name) {
          globalThis.startupCalls.opened = name;
          return { closeSync() {}, execSync() {}, runSync() {}, getFirstSync() {}, getAllSync() {} };
        }`,
      }));
    } }],
  });
  const module = { exports: {} };
  const startupCalls = {};
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require,
    Uint8Array, Buffer, console, process, URL, startupCalls }, { filename: entry });
  return { ...module.exports, startupCalls };
}

test('head bootstrap uses palette canvases and safely honors only forced saved themes', async () => {
  const { webStartupScript, webStartupStyle } = await bundle('design-system/theme/webStartup.ts');
  assert.match(webStartupStyle, /prefers-color-scheme: dark/);
  assert.match(webStartupStyle, /--startup-canvas: #f9f9f9/);
  assert.match(webStartupStyle, /--startup-canvas: #141414/);
  assert.doesNotMatch(webStartupStyle + webStartupScript, /ff8b41/i);
  for (const preference of ['dark', 'light', 'system', null, 'invalid']) {
    const style = { setProperty(key, value) { this[key] = value; } };
    vm.runInNewContext(webStartupScript, {
      localStorage: { getItem(key) { assert.equal(key, 'macro-tracker:theme-preference'); return preference; } },
      document: { documentElement: { style } },
    });
    assert.equal(style['--startup-canvas'], preference === 'dark' ? '#141414' : preference === 'light' ? '#f9f9f9' : undefined);
  }
  assert.doesNotThrow(() => vm.runInNewContext(webStartupScript, {
    get localStorage() { throw new Error('storage blocked'); },
  }));
  assert.doesNotThrow(() => vm.runInNewContext(webStartupScript, {}));
});

test('static fallback and head bootstrap share the canvas before hydration', () => {
  const layout = readFileSync(root + 'app/_layout.tsx', 'utf8');
  const html = readFileSync(root + 'app/+html.tsx', 'utf8');
  assert.match(layout, /backgroundColor: 'var\(--startup-canvas\)'/);
  assert.doesNotMatch(layout, /lightPalette\.brand/);
  assert.match(layout, /contentStyle: \{ backgroundColor: colors\.canvas \}/);
  assert.ok(html.indexOf('__html: webStartupScript') < html.indexOf('<body>'));
  assert.match(html, /__html: webStartupStyle/);
});

test('web opens asynchronous sql.js without even loading the synchronous expo-sqlite bridge', async () => {
  const { openRuntimeDb, startupCalls } = await bundle('components/UserDataProvider.tsx', 'web');
  const opened = await openRuntimeDb();
  assert.equal(opened.persistSqlJs, true);
  assert.equal(opened.db.get('SELECT 1 AS value').value, 1);
  opened.db.close();
  assert.deepEqual(startupCalls, {});
});


test('native still opens the persistent Expo database synchronously', async () => {
  const { openRuntimeDb, startupCalls } = await bundle('components/UserDataProvider.tsx', 'ios');
  const opened = await openRuntimeDb();
  assert.equal(opened.persistSqlJs, false);
  assert.deepEqual(startupCalls, { loaded: true, opened: 'UserData.sqlite' });
  opened.db.close();
});
