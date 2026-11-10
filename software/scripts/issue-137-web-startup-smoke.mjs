// Real static Expo export, Chromium CDP, no browser automation dependency.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseline = process.argv.includes('--baseline');
const slowSqlite = process.argv.includes('--slow-sqlite');
const directory = resolve(process.argv[2] || 'dist');
const software = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(resolve(software, '.chrome-137-'));
const server = createServer(async (req, res) => {
  try {
    let path = resolve(directory, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== directory && !path.startsWith(directory + sep)) throw new Error('invalid path');
    if (!extname(path)) path += path === directory ? '/index.html' : '.html';
    const content = await readFile(path);
    if (slowSqlite && path.includes('wa-sqlite') && path.endsWith('.wasm')) await new Promise(r => setTimeout(r, 1200));
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
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
        ${preference && preference !== 'blocked' ? `localStorage.setItem('macro-tracker:theme-preference', ${JSON.stringify(preference)});` : ''}
      }
      ${preference === 'blocked' ? `Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } });` : ''}
      window.startup = { id: Math.random(), frames: [], tasks: [], ready: null, opens: [] };
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function(message, ...args) {
        if (message.type === 'open') {
          if (message.data.databasePath.endsWith('UserData.sqlite')) {
            window.sqliteWorker = this;
            window.sqliteDatabaseId = message.data.nativeDatabaseId;
          }
          const open = {path: message.data.databasePath, sync: message.isSync, start: performance.now()};
          startup.opens.push(open);
          this.addEventListener('message', event => {
            if (event.data.id === message.id) { open.end = performance.now(); open.error = event.data.error ? String(event.data.error) : null; }
          });
          const result = post.call(this, message, ...args);
          if (message.isSync) setTimeout(() => { open.mainThreadResumed = performance.now(); }, 0);
          return result;
        }
        return post.call(this, message, ...args);
      };
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
    // Seed the authoritative theme through the actual Expo worker/database,
    // then reload to verify it survives. No sql.js or localStorage DB fixture.
    await send('Page.navigate', { url: origin });
    const warmDeadline = Date.now() + 30000;
    while (!await evaluate('Boolean(window.startup?.ready)') && Date.now() < warmDeadline) await delay(100);
    if (baseline) {
      console.log(JSON.stringify({build: 'sync-open-investigation', startup: await evaluate('startup'), fallbackSqlJs: await evaluate("Boolean(localStorage.getItem('macro-tracker:UserData.sqljs.b64'))"), resources: await evaluate("performance.getEntriesByType('resource').map(e => ({name:e.name.split('/').pop(),start:e.startTime,duration:e.duration}))")}));
      await cdp('Target.closeTarget', {targetId});
      continue;
    }
    assert.ok(await evaluate('Boolean(window.sqliteWorker)'), 'Expo SQLite worker was not opened');
    await evaluate(`new Promise((resolve, reject) => {
      const id = -137;
      const listener = event => {
        if (event.data.id !== id) return;
        sqliteWorker.removeEventListener('message', listener);
        event.data.error ? reject(new Error(event.data.error)) : resolve(true);
      };
      sqliteWorker.addEventListener('message', listener);
      sqliteWorker.postMessage({type: 'exec', id, isSync: false, data: {
        nativeDatabaseId: sqliteDatabaseId,
        source: "INSERT INTO app_setting (key,value,updated_at) VALUES ('theme_preference','${['dark', 'light'].includes(preference) ? preference : 'system'}','smoke') ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      }});
    })`);
    if (preference !== 'blocked') await evaluate(`localStorage.setItem('macro-tracker:theme-preference', ${JSON.stringify(preference || 'system')})`);
    for (let reload = 0; reload < (baseline ? 1 : 2); reload++) {
      const previousId = await evaluate('window.startup?.id');
      await send('Page.reload', {ignoreCache: true});
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
        const userOpen = result.opens.find(o => o.path.endsWith('UserData.sqlite'));
        assert.ok(userOpen && !userOpen.sync && userOpen.end, 'persistent Expo database not opened asynchronously');
        assert.ok(result.frames.some(f => f.t > userOpen.start && f.t < userOpen.end), 'no frame painted while Expo SQLite was opening');
        if (slowSqlite) assert.ok(userOpen.end - userOpen.start >= 1200, 'SQLite WASM delay was not exercised');
        assert.ok(result.opens.every(o => !o.error), `Expo open error: ${JSON.stringify(result.opens)}`);
        assert.equal(await evaluate(`localStorage.getItem('macro-tracker:UserData.sqljs.b64')`).catch(() => null), null, 'unexpected sql.js fallback persistence');
        // Existing synchronous queries/migrations remain outside this first-paint fix.
        // Record their long tasks; gate on frames during open and canvas colors.
        assert.ok(result.frames.every(f => f.color !== 'rgb(255, 139, 65)'), 'orange frame');
        if (preference === 'dark') assert.ok(result.frames.every(f => f.color === 'rgb(20, 20, 20)'), `dark startup flashed another canvas: ${JSON.stringify(result)}`);
        if (preference !== 'blocked') {
          const saved = await evaluate(`localStorage.getItem('macro-tracker:theme-preference')`);
          assert.equal(saved, preference || 'system');
        }
      }
      console.log(JSON.stringify({ build: baseline ? 'before' : 'after', preference, system, reload, firstFrame: first, firstNonOrangeFrame: result.frames.find(f => f.color !== 'rgb(255, 139, 65)'), screenMs: result.ready, maxTaskMs: maxTask, tasks: result.tasks, opens: result.opens, slowSqlite, wasm }));
    }
    await cdp('Target.closeTarget', { targetId });
    await delay(200);
  }
} finally {
  chrome.kill('SIGKILL');
  await new Promise(r => chrome.once('exit', r));
  await new Promise(r => server.close(r));
  // Chromium child processes can finish writing the profile after the parent exits.
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
