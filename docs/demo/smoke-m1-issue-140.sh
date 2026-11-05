#!/usr/bin/env bash
# M1-74 (#140): Today day-navigation glyphs, including undefined web RTL flag.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
PORT="${EXPO_WEB_SMOKE_PORT:-18140}"
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
TMP_DIR="$(mktemp -d "$ROOT/software/.smoke-140.XXXXXX")"
SERVER_PID=""
CHROME_PID=""
cleanup() {
  if [[ -n "$CHROME_PID" ]]; then
    kill "$CHROME_PID" 2>/dev/null || true
    wait "$CHROME_PID" 2>/dev/null || true
  fi
  if [[ -n "$SERVER_PID" ]]; then
    kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "==> typecheck"
npx tsc --noEmit
echo "==> lint"
npm run -s lint
echo "==> focused day-navigation regression tests"
node --test scripts/issue-140-day-navigation.test.mjs
echo "==> full serialized test suite"
mapfile -t TEST_FILES < <(node -e \
  "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"

echo "==> Expo web rendered glyphs (Chrome, 390x844)"
test -n "$CHROME" || { echo "Chrome is required" >&2; exit 1; }
npm run sync-web-wasm
CI=1 setsid npx expo start --web --port "$PORT" >"$TMP_DIR/expo.log" 2>&1 &
SERVER_PID="$!"
READY=false
for _attempt in {1..240}; do
  if curl --fail --silent "http://127.0.0.1:$PORT/today" > /dev/null; then
    READY=true
    break
  fi
  kill -0 "$SERVER_PID" 2>/dev/null || { cat "$TMP_DIR/expo.log"; exit 1; }
  sleep 0.5
done
"$READY" || { cat "$TMP_DIR/expo.log"; exit 1; }
# Use real time: virtual time can stall Expo SQLite's worker startup.
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="$TMP_DIR/chrome-profile" --remote-debugging-port=0 \
  --no-first-run about:blank >"$TMP_DIR/chrome.log" 2>&1 &
CHROME_PID="$!"
for _attempt in {1..80}; do
  test -s "$TMP_DIR/chrome-profile/DevToolsActivePort" && break
  sleep 0.25
done
DEBUG_PORT="$(head -n 1 "$TMP_DIR/chrome-profile/DevToolsActivePort")"
DEBUG_PORT="$DEBUG_PORT" EXPO_PORT="$PORT" timeout 90s node <<'NODE'
const assert = require('node:assert/strict');
const WebSocket = require('ws'); // Expo/Metro dependency; same as the issue-76 smoke.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT}/json/list`)).json();
  const ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
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
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${process.env.EXPO_PORT}/today` });
    let actual;
    for (let attempt = 0; attempt < 240; attempt++) {
      actual = await evaluate(`['Previous day', 'Next day'].map(label =>
        document.querySelector('[role="button"][aria-label="' + label + '"]')?.textContent.trim())`);
      if (actual.every((glyph) => glyph != null)) break;
      await sleep(250);
    }
    assert.deepEqual(actual, ['‹', '›']);
    console.log('OK: Expo Today renders Previous day = ‹ and Next day = › in Chrome (390x844)');
  } finally {
    ws.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
NODE

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-140 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit=$(git -C "$ROOT" rev-parse --short HEAD)"
  echo "typecheck=npx tsc --noEmit PASS"
  echo "lint=npm run lint PASS (existing warnings only)"
  echo "focused=node --test scripts/issue-140-day-navigation.test.mjs PASS"
  echo "regression=production DateSelector; LTR, RTL, undefined and missing RTL flag; glyphs, labels and day-change callbacks"
  echo "full-suite=node --test --test-concurrency=1 (all package.json test files) PASS"
  echo "web-verification=Expo /today in headless Chrome at 390x844; rendered button text: Previous day = ‹, Next day = ›"
  echo "rtl-verification=unit coverage; native RTL device check not performed"
} | tee "$ROOT/out/issue-140-smoke-result.txt"
