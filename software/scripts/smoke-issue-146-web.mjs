// Real Expo Router/browser-history regression, driven via Chrome DevTools.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const base = process.env.ISSUE146_BASE_URL || 'http://127.0.0.1:18146';
const targets = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT}/json/list`)).json();
const ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
  else callback.resolve(message.result);
});
function send(method, params) {
  return new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function waitFor(expression, description) {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      if (await evaluate(expression)) return;
    } catch (error) {
      // Cross-document navigation can invalidate a pending Runtime.evaluate.
      if (!/context|navigated|closed/i.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out: ${description}; URL=${await evaluate('location.href')}`);
}
const selector = (role, label) => `[role="${role}"][aria-label="${label}"]`;
async function click(role, label) {
  const query = JSON.stringify(selector(role, label));
  await waitFor(`!!document.querySelector(${query})`, label);
  await evaluate(`document.querySelector(${query}).click()`);
}
async function at(path, role, label) {
  await waitFor(`location.pathname === ${JSON.stringify(path)} && !!document.querySelector(${JSON.stringify(selector(role, label))})`, path);
  // Allow the linking state listener to finish before the next browser action.
  await new Promise((resolve) => setTimeout(resolve, 300));
}
async function browserMove(delta) {
  const history = await send('Page.getNavigationHistory');
  const entry = history.entries[history.currentIndex + delta];
  assert.ok(entry, `browser history has entry at delta ${delta}`);
  await send('Page.navigateToHistoryEntry', { entryId: entry.id });
}
async function fresh(path) {
  // Keep a real outside-app entry immediately before the deep link.
  await send('Page.navigate', { url: 'about:blank#issue-146-outside' });
  await waitFor('location.href === "about:blank#issue-146-outside"', 'outside-app entry');
  await send('Page.navigate', { url: base + path });
}
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await fresh('/settings');
  await at('/settings', 'button', 'Units & appearance');
  await click('button', 'Units & appearance');
  await at('/settings/units', 'button', 'Back to Settings');
  await browserMove(-1);
  await at('/settings', 'button', 'Units & appearance');
  // Record any attempted pop as well as the final destination. A tab press must
  // never call history.go/back, even if the eventual URL is repaired afterward.
  await evaluate(`window.__tabPops = []; for (const method of ['go', 'back']) {
    const original = history[method].bind(history);
    history[method] = (...args) => { window.__tabPops.push([method, ...args]); return original(...args); };
  }`);
  await click('tab', 'Today');
  await at('/today', 'tab', 'Today');
  assert.deepEqual(await evaluate('window.__tabPops'), []);
  assert.equal(await evaluate('location.origin'), new URL(base).origin);
  await browserMove(-1);
  await at('/settings', 'button', 'Units & appearance');
  await browserMove(1);
  await at('/today', 'tab', 'Today');
  await click('tab', 'Settings');
  await at('/settings', 'button', 'Units & appearance');
  await click('button', 'Units & appearance');
  await at('/settings/units', 'button', 'Back to Settings');
  await browserMove(-1);
  await at('/settings', 'button', 'Units & appearance');
  await browserMove(1);
  await at('/settings/units', 'button', 'Back to Settings');
  await browserMove(-1);
  await at('/settings', 'button', 'Units & appearance');
  await click('tab', 'Today');
  await at('/today', 'tab', 'Today');
  assert.deepEqual(await evaluate('window.__tabPops'), []);
  // Repeated visits must append rather than deduplicate earlier tab history.
  for (const [path, label] of [['/settings', 'Settings'], ['/analytics', 'Analytics'], ['/today', 'Today'], ['/food-entry', 'Search foods'], ['/settings', 'Settings']]) {
    await click('tab', label);
    await at(path, 'tab', label);
    assert.deepEqual(await evaluate('window.__tabPops'), []);
  }
  await browserMove(-1);
  await at('/food-entry', 'tab', 'Search foods');
  await browserMove(1);
  await at('/settings', 'button', 'Units & appearance');
  for (const page of ['profile', 'units', 'about', 'licenses', 'privacy']) {
    await fresh(`/settings/${page}`);
    await at(`/settings/${page}`, 'button', 'Back to Settings');
    await click('button', 'Back to Settings');
    await at('/settings', 'button', 'Units & appearance');
    await click('tab', 'Today');
    await at('/today', 'tab', 'Today');
  }
  console.log('Expo web / Chrome 390x844 PASS: /settings → Units → browser Back/Forward/Back → Today stays in app with no history pop; repeated tab visits and browser Back/Forward PASS; all five /settings/* deep links and header return → Today PASS.');
} finally {
  ws.close();
}
