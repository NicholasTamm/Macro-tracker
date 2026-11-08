// Real Expo web tab-label geometry regression, driven via Chrome DevTools.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const base = process.env.ISSUE145_BASE_URL || 'http://127.0.0.1:18145';
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
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: base + '/settings' });
  await waitFor(`!!document.querySelector('[role="tab"][aria-label="Settings"]')`, 'Settings tab');
  await waitFor(`document.fonts.check('11px "Figtree_500Medium"') && [...document.fonts].some(f => f.family.includes("Figtree") && f.status === "loaded")`, 'Figtree loaded');
  for (const scheme of ['light', 'dark']) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    for (const width of [390, 414, 430]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await new Promise(resolve => setTimeout(resolve, 300));
      const result = await evaluate(`(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
        const tabs = [...document.querySelectorAll('[role="tab"]')];
        const labels = tabs.map(tab => {
          const label = [...tab.querySelectorAll('*')].filter(el => ['Today','Analytics','Search','Settings','Gallery'].includes(el.textContent)).at(-1);
          if (!label) throw new Error('Missing label: ' + tab.textContent);
          const box = rect(label);
          const style = getComputedStyle(label);
          const clippedBy = [];
          for (let el = label.parentElement; el; el = el.parentElement) {
            const s = getComputedStyle(el), r = rect(el);
            if (/(hidden|clip|scroll|auto)/.test(s.overflowY) && (box.top < r.top - 0.5 || box.bottom > r.bottom + 0.5)) clippedBy.push(el.tagName);
          }
          const range = document.createRange(); range.selectNodeContents(label);
          const text = range.getBoundingClientRect();
          return { name: label.textContent, box, target: rect(tab), lineHeight: parseFloat(style.lineHeight), font: style.fontFamily,
            textBottom: text.bottom, clippedBy };
        });
        // React Navigation renders tablist inside the styled bar container.
        const bar = tabs[0].closest('[role="tablist"]').parentElement;
        return { labels, bar: rect(bar), background: getComputedStyle(bar).backgroundColor,
          settingsButton: rect(document.querySelector('[aria-label="Units & appearance"]')), viewportHeight: innerHeight };
      })()`);
      assert.ok(result.labels.length >= 4);
      assert.equal(result.background, scheme === 'dark' ? 'rgb(37, 37, 37)' : 'rgb(255, 255, 255)', scheme + ' bar palette');
      assert.ok(result.bar.bottom <= result.viewportHeight + 0.5);
      assert.ok(result.settingsButton.bottom <= result.bar.top, 'screen controls remain above tab bar');
      for (const label of result.labels) {
        const context = `${scheme} ${width}: ${label.name}`;
        assert.match(label.font, /Figtree/, context);
        assert.ok(label.box.height >= label.lineHeight, context + ' full line box');
        assert.ok(label.target.height >= 44 && label.target.width >= 44, context + ' hit target');
        assert.ok(label.box.bottom <= label.target.bottom && label.box.bottom <= result.bar.bottom, context + ' label fits');
        assert.ok(label.textBottom <= label.box.bottom + 0.5, context + ' glyphs fit line box');
        assert.deepEqual(label.clippedBy, [], context + ' no ancestor clipping');
      }
      console.log(`PASS Expo web Chrome ${width}x844 ${scheme}: Figtree labels Today/Analytics/Search/Settings/Gallery have full line boxes, unclipped glyph bounds, >=44px targets; screen controls above bar (${result.bar.height}px).`);
    }
  }
} finally {
  ws.close();
}
