// Real Expo web app, controlled through Chrome DevTools (ws is a Metro dependency).
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import WebSocket from 'ws';

const outfile = join(process.env.SMOKE_TMP_DIR, 'store.mjs');
await build({ entryPoints: ['modules/app-core/user-data/index.ts'], outfile,
  bundle: true, format: 'esm', platform: 'node', external: ['sql.js', 'expo-sqlite', 'node-sqlite3-wasm'] });
const store = await import(pathToFileURL(outfile).href);
const db = await store.openSqlJsDatabase();
store.migrateUserStore(db);
store.saveAdultGate(db, true);
store.completeOnboardingWithStarterTarget(db);
const seed = Buffer.from(db.exportBytes()).toString('base64');
db.close();
const targets = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT}/json/list`)).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
let id = 0;
const pending = new Map();
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  if (message.error) task.reject(new Error(JSON.stringify(message.error)));
  else task.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (await evaluate(expression)) return;
    await sleep(250);
  }
  throw new Error(`Timed out: ${expression}; body=${await evaluate('document.body.innerText')}`);
}
async function click(label) {
  const selector = `[aria-label="${label}"]`;
  await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function visit(path, label) {
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.EXPO_PORT}${path}` });
  await waitFor(`document.body?.innerText.includes(${JSON.stringify(label)})`);
}
async function check(scheme, header = false) {
  const canvas = scheme === 'dark' ? 'rgb(20, 20, 20)' : 'rgb(249, 249, 249)';
  const divider = scheme === 'dark' ? 'rgb(58, 58, 60)' : 'rgb(229, 229, 229)';
  // Navigation containers must update in place, including ancestors behind screens.
  await waitFor(`Array.from(document.querySelectorAll('#root *')).some(el => getComputedStyle(el).backgroundColor === '${canvas}')`);
  await sleep(300);
  const result = await evaluate(`(() => {
    const styles = Array.from(document.querySelectorAll('#root *')).map(el => getComputedStyle(el));
    return {
      bad: styles.filter(s => s.backgroundColor === 'rgb(242, 242, 242)' ||
        (parseFloat(s.borderBottomWidth) > 0 && s.borderBottomColor === 'rgb(216, 216, 216)')).length,
      divider: styles.some(s => parseFloat(s.borderBottomWidth) > 0 && s.borderBottomColor === '${divider}'),
      canvas: styles.filter(s => s.backgroundColor === '${canvas}').length
    };
  })()`);
  assert.equal(result.bad, 0, `${scheme}: default light navigation surfaces`);
  assert.ok(result.canvas > 0);
  if (header) assert.ok(result.divider, `${scheme}: header uses divider token`);
}
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (!localStorage.getItem('macro-tracker:UserData.sqljs.b64')) localStorage.setItem('macro-tracker:UserData.sqljs.b64', ${JSON.stringify(seed)});` });
  await visit('/settings/units', 'Save units and appearance');
  // A sentinel proves appearance changes do not reload the page.
  await evaluate('window.issue144Live = true');
  for (const [label, scheme] of [['Dark theme', 'dark'], ['Light theme', 'light'], ['Use system theme', 'light']]) {
    await click(label);
    await click('Save units and appearance');
    await check(scheme);
    assert.equal(await evaluate('window.issue144Live'), true);
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await check('dark');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await check('light');
  await click('Dark theme');
  await click('Save units and appearance');
  await check('dark');
  for (const [path, label, header] of [
    ['/today', 'Today', false], ['/food-entry', 'Search', true],
    ['/analytics', 'Analytics', true], ['/settings', 'Settings', true],
    ['/settings/profile', 'Profile', false], ['/settings/units', 'Save units and appearance', false],
    ['/settings/about', 'About', false], ['/settings/licenses', 'licenses', false],
    ['/settings/privacy', 'Privacy', false],
  ]) {
    await visit(path, label);
    await check('dark', header);
    console.log(`PASS dark ${path}: no default light backgrounds/hairlines`);
  }
  console.log('PASS Expo web Chrome 390x844: Light/Dark/System saves and OS changes update live; canvas and header divider tokens verified.');
} finally {
  ws.close();
}
