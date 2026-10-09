import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const appUrl = process.argv[2] ?? 'http://127.0.0.1:18171';
const chromeBin = process.env.CHROME_BIN ?? 'google-chrome';
const debuggingPort = 19000 + (process.pid % 1000);
const profileDir = mkdtempSync(join(tmpdir(), 'macro-tracker-issue-71-'));
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function waitForDebugger() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      return await fetchJson(`http://127.0.0.1:${debuggingPort}/json/version`);
    } catch {
      await delay(100);
    }
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  const opened = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      socket.close();
    },
  };
}

async function main() {
  await waitForDebugger();
  const target = await fetchJson(
    `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(appUrl)}`,
    { method: 'PUT' },
  );
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed.');
    }
    return result.result.value;
  };

  const waitFor = async (expression, description, timeoutMs = 20_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  };

  const hasLabel = (label) =>
    `Boolean([...document.querySelectorAll('[aria-label]')].find((node) => node.getAttribute('aria-label') === ${JSON.stringify(label)}))`;
  const clickLabel = async (label) => {
    await waitFor(hasLabel(label), JSON.stringify(label));
    const clicked = await evaluate(`(() => {
      const node = [...document.querySelectorAll('[aria-label]')]
        .find((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)});
      if (!node) return false;
      node.click();
      return true;
    })()`);
    assert.equal(clicked, true, `could not click ${label}`);
  };
  const waitForText = (text) => waitFor(
    `document.body?.innerText.includes(${JSON.stringify(text)})`,
    JSON.stringify(text),
  );
  const navigate = async (path) => {
    await cdp.send('Page.navigate', { url: new URL(path, appUrl).href });
  };
  const bananaCount = () => evaluate(`(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let count = 0;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim() === 'Bananas, raw') count += 1;
    }
    return count;
  })()`);
  const pagePalette = () => evaluate(`[...new Set(
    [...document.querySelectorAll('body, body *')]
      .map((node) => getComputedStyle(node).backgroundColor)
      .filter((color) => color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')
  )].sort()`);

  await clickLabel('I am 18 or older');
  await waitForText('Choose your units');
  await clickLabel('Continue');
  await waitForText('Biometrics');
  await clickLabel('Continue');
  await waitForText('Goal and rate');
  await clickLabel('Continue');
  await waitForText('Safety exclusions');
  await clickLabel('Continue');
  await waitForText('Starter target');
  await clickLabel('Finish onboarding');
  await waitForText('Today');

  await navigate('/food-entry');
  await waitFor(hasLabel('Search foods'), 'Search foods');
  const enteredSearch = await evaluate(`(() => {
    const input = document.querySelector('[aria-label="Search foods"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'banana');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(enteredSearch, true);
  await waitForText('Bananas, raw');
  await clickLabel('Select');
  await waitFor(hasLabel('Food detail for Bananas, raw'), 'banana food detail');
  await clickLabel('Log to Today');
  await waitForText('Bananas, raw');
  assert.equal(await bananaCount(), 1, 'banana should be logged exactly once before theme save');

  await navigate('/settings/units');
  await waitForText('Units & appearance');
  const lightPalette = await pagePalette();
  await clickLabel('Dark theme');
  await clickLabel('Save units and appearance');
  await waitForText('Settings saved.');
  await waitFor(
    `JSON.stringify([...new Set(
      [...document.querySelectorAll('body, body *')]
        .map((node) => getComputedStyle(node).backgroundColor)
        .filter((color) => color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')
    )].sort()) !== ${JSON.stringify(JSON.stringify(lightPalette))}`,
    'dark ThemeProvider palette',
  );

  await navigate('/today');
  await waitForText('Bananas, raw');
  assert.equal(await bananaCount(), 1, 'theme save changed the visible Today diary');

  await cdp.send('Page.reload', { ignoreCache: true });
  await waitForText('Bananas, raw');
  assert.equal(await bananaCount(), 1, 'browser reload changed the visible Today diary');
  assert.equal(
    await evaluate(`localStorage.getItem('macro-tracker:UserData.sqljs.b64') !== null`),
    true,
    'UserDataProvider did not persist the web database',
  );

  cdp.close();
  process.stdout.write('web UI smoke: settings save, ThemeProvider rerender, Today revisit, and browser reload preserved one banana row\n');
}

try {
  await main();
} finally {
  chrome.kill('SIGTERM');
  rmSync(profileDir, { recursive: true, force: true });
}
