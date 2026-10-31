// Real static Expo export, Chromium CDP, no browser automation dependency.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const baseline = process.argv.includes('--baseline');
const directory = resolve(process.argv[2] || 'dist');
const software = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(resolve(software, '.chrome-137-'));
const server = createServer(async (req, res) => {
  try {
    let path = resolve(directory, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== directory && !path.startsWith(directory + sep)) throw new Error('invalid path');
    if (!extname(path)) path += path === directory ? '/index.html' : '.html';
    const content = await readFile(path);
    res.writeHead(200, {
      'Content-Type': ({ '.html': 'text/html', '.js': 'application/javascript', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    });
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let sequence = 0, buffer = '';
const pending = new Map();
const browserErrors = [];

chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params);
    if (message.id) {
      const callback = pending.get(message.id); pending.delete(message.id);
      if (message.error) callback?.reject(new Error(JSON.stringify(message.error)));
      else callback?.resolve(message.result);
    }
  }
});
function cdp(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: e => { clearTimeout(timer); reject(e); } });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}
const SQL = await initSqlJs();
function savedDb(theme) {
  const db = new SQL.Database();
  db.run('CREATE TABLE app_setting (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
  db.run('INSERT INTO app_setting VALUES (?, ?, ?)', ['theme_preference', theme, new Date().toISOString()]);
  const bytes = Buffer.from(db.export()).toString('base64'); db.close(); return bytes;
}
const delay = ms => new Promise(r => setTimeout(r, ms));
try {
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  if (!baseline) {
    assert.doesNotMatch(html, /background-color:rgba\(255,139,65,1\.00\)/);
    assert.match(html, /var\(--startup-canvas\)/);
  }
  for (const [preference, system] of baseline ? [['dark', 'light']] : [
    ['dark', 'light'], ['light', 'dark'], ['system', 'dark'], [null, 'dark'], [null, 'light'], ['blocked', 'dark'],
  ]) {
    const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => cdp(method, params, sessionId);
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: system }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      if (location.origin === ${JSON.stringify(origin)} && !sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', 'yes');
        localStorage.clear();
        ${preference && preference !== 'blocked' ? `localStorage.setItem('macro-tracker:theme-preference', ${JSON.stringify(preference)});
        localStorage.setItem('macro-tracker:UserData.sqljs.b64', ${JSON.stringify(savedDb(preference))});` : ''}
      }
      ${preference === 'blocked' ? `Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } });` : ''}
      window.startup = { id: Math.random(), frames: [], tasks: [], ready: null };
      new PerformanceObserver(list => startup.tasks.push(...list.getEntries().map(e => ({start: e.startTime, duration: e.duration}))))
        .observe({type: 'longtask', buffered: true});
      function frame(t) {
        const ready = document.body?.innerText.includes('Confirm you are an adult');
        if (!startup.ready) {
          const layers = document.elementsFromPoint(2, 400);
          const color = layers.map(e => getComputedStyle(e).backgroundColor)
            .find(c => c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent');
          if (color) startup.frames.push({t, color});
          if (ready) startup.ready = t;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    ` });
    // Block the external app bundle to prove the inline bootstrap colors the
    // static markup before React runs, then verify the real startup and reload.
    if (!baseline) {
      await send('Network.setBlockedURLs', { urls: ['*entry-*.js'] });
      await send('Page.navigate', { url: origin });
      await delay(600);
      const before = await evaluate('startup.frames');
      const expected = preference === 'dark' || (preference !== 'light' && system === 'dark') ? 'rgb(20, 20, 20)' : 'rgb(249, 249, 249)';
      assert.ok(before.length, 'no pre-hydration frames');
      assert.ok(before.every(f => f.color === expected), `pre-hydration ${preference}/${system}: ${JSON.stringify(before)}`);
      await send('Network.setBlockedURLs', { urls: [] });
    }
    for (let reload = 0; reload < (baseline ? 1 : 2); reload++) {
      const previousId = await evaluate('window.startup?.id');
      await send('Page.navigate', { url: origin });
      let result;
      const deadline = Date.now() + 20000;
      do { await delay(100); result = await evaluate('window.startup'); } while ((!result?.ready || result.id === previousId) && Date.now() < deadline);
      assert.ok(result?.ready && result.id !== previousId, `age gate did not appear: ${preference}/${system}: ${JSON.stringify(await evaluate('({text: document.body.innerText, startup, errors: null})'))}; ${JSON.stringify(browserErrors)}`);
      await delay(300);
      result = await evaluate('startup');
      const maxTask = Math.max(0, ...result.tasks.map(e => e.duration));
      const first = result.frames[0];
      const wasm = await evaluate(`performance.getEntriesByType('resource').filter(e => e.name.includes('.wasm')).map(e => ({name: e.name.split('/').pop(), start: e.startTime, duration: e.duration}))`);
      if (!baseline) {
        assert.ok(maxTask < 1000, `startup long task ${maxTask}ms`);
        assert.ok(result.frames.every(f => f.color !== 'rgb(255, 139, 65)'), 'orange frame');
        if (preference === 'dark') assert.ok(result.frames.every(f => f.color === 'rgb(20, 20, 20)'), `dark startup flashed another canvas: ${JSON.stringify(result)}`);
        if (preference !== 'blocked') {
          const saved = await evaluate(`localStorage.getItem('macro-tracker:theme-preference')`);
          assert.equal(saved, preference || 'system');
        }
      }
      console.log(JSON.stringify({ build: baseline ? 'before' : 'after', preference, system, reload, firstFrame: first, firstNonOrangeFrame: result.frames.find(f => f.color !== 'rgb(255, 139, 65)'), screenMs: result.ready, maxTaskMs: maxTask, wasm }));
    }
    await cdp('Target.closeTarget', { targetId });
  }
} finally {
  chrome.kill('SIGKILL');
  await new Promise(r => chrome.once('exit', r));
  await new Promise(r => server.close(r));
  // Chromium child processes can finish writing the profile after the parent exits.
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
