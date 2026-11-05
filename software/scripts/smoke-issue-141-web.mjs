// Run against an Expo web export. PLAYWRIGHT_CORE_PATH may point to an existing installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(root, '.issue-141-web-'));
let browser;
try {
  const outfile = join(temp, 'store.mjs');
  await build({ entryPoints: [join(root, 'modules/app-core/user-data/index.ts')], outfile,
    bundle: true, format: 'esm', platform: 'node', external: ['sql.js', 'expo-sqlite', 'node-sqlite3-wasm'] });
  const store = await import(pathToFileURL(outfile).href);
  const db = await store.openSqlJsDatabase();
  store.migrateUserStore(db);
  store.saveAdultGate(db, true);
  store.completeOnboardingWithStarterTarget(db);
  store.createCustomFood(db, { name: 'Date smoke bowl', basisKind: 'serving', basisAmount: 1, basisUnit: 'bowl', gramWeightForBasis: 100,
    nutrients: { energy_kcal: 100, protein: 5, carbohydrate: 10, fat_total: 2 } });
  const seed = Buffer.from(db.exportBytes()).toString('base64');
  db.close();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Creston' });
  await context.addInitScript((data) => {
    const key = 'macro-tracker:UserData.sqljs.b64';
    if (!localStorage.getItem(key)) localStorage.setItem(key, data);
  }, seed);
  const page = await context.newPage();
  const base = process.env.ISSUE141_BASE_URL || 'http://127.0.0.1:18141';
  async function visit(path) { await page.goto(base + path); }
  async function openSheet(label, day) {
    await page.getByRole('button', { name: 'Select Date smoke bowl', exact: true }).first().click();
    await page.getByRole('button', { name: `Log to ${label}`, exact: true }).waitFor();
    assert.ok((await page.locator('body').innerText()).includes(`Logs to ${day} at`));
  }
  async function persistedEntries() {
    const b64 = await page.evaluate(() => localStorage.getItem('macro-tracker:UserData.sqljs.b64'));
    const saved = await store.openSqlJsDatabase(new Uint8Array(Buffer.from(b64, 'base64')));
    try { return saved.all('SELECT local_day_key FROM diary_entry WHERE deleted_at IS NULL'); }
    finally { saved.close(); }
  }
  // Derive calendar dates in the same zone as the browser.
  const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Creston' }));
  const shift = (day, delta) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); };
  for (const [label, delta, nav] of [['Yesterday', -1, 'Previous day'], ['Tomorrow', 1, 'Next day']]) {
    await visit('/today');
    await page.getByRole('button', { name: nav, exact: true }).click();
    await page.getByRole('button', { name: 'Log food', exact: true }).click();
    const day = shift(today, delta);
    await openSheet(label, day);
    await page.getByRole('button', { name: `Log to ${label}`, exact: true }).click();
    await page.getByLabel(`Selected day ${label}`, { exact: true }).waitFor();
    assert.ok((await persistedEntries()).some(row => row.local_day_key === day));
  }
  // Search retains tomorrow's route params; the tab-bar press must clear them.
  await page.getByRole('tab', { name: 'Search foods', exact: true }).click();
  await openSheet('Today', today);
  await page.getByRole('button', { name: 'Log to Today', exact: true }).click();
  await page.getByLabel('Selected day Today', { exact: true }).waitFor();
  assert.equal((await persistedEntries()).filter(row => row.local_day_key === today).length, 1);
  // Change the viewed day after a return, then repeat tab-bar logging to Today.
  // The return date must win even when Today previously received the same date.
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await page.getByRole('tab', { name: 'Search foods', exact: true }).click();
  await openSheet('Today', today);
  await page.getByRole('button', { name: 'Log to Today', exact: true }).click();
  await page.getByLabel('Selected day Today', { exact: true }).waitFor();
  assert.equal((await persistedEntries()).filter(row => row.local_day_key === today).length, 2);
  for (const path of ['/food-entry?date=2026-02-30', '/food-entry']) {
    await visit(path);
    await openSheet('Today', today);
    await page.getByRole('button', { name: 'Close food detail', exact: true }).click();
  }
  console.log('Expo web / Chrome 390x844: Yesterday and Tomorrow labels, persisted dates and return day PASS; repeated tab-bar logging after changing day, retained Search tab reset, missing/invalid dates PASS.');
} finally {
  await browser?.close();
  rmSync(temp, { recursive: true, force: true });
}
