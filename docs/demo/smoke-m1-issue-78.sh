#!/usr/bin/env bash
# M1-29 smoke: web export download fallback (browser downloads JSON+CSV).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOFTWARE="$ROOT/software"
PORT="${EXPORT_SMOKE_PORT:-18078}"
BASE_URL="http://127.0.0.1:$PORT"
TMP_DIR="$(mktemp -d)"
DOWNLOAD_DIR="$TMP_DIR/downloads"
SERVER_PID=""
CHROME_PID=""
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
WS_NODE_PATH="${EXPORT_SMOKE_WS_NODE_PATH:-/tmp/export-smoke-node/node_modules}"
cd "$SOFTWARE"

cleanup() {
  if [[ -n "${CHROME_PID}" ]] && kill -0 "$CHROME_PID" 2>/dev/null; then
    kill "$CHROME_PID" 2>/dev/null || true
    wait "$CHROME_PID" 2>/dev/null || true
  fi
  if [[ -n "${SERVER_PID}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

test -f modules/app-core/export/webExport.ts || fail "missing webExport.ts"
test -f modules/app-core/export/shareExport.test.mjs || fail "missing shareExport tests"
rg -n "shareExport\.test\.mjs" package.json >/dev/null || fail "package test script missing shareExport tests"
test -n "$CHROME" || fail "Chrome is required for browser download smoke"
test -d "$WS_NODE_PATH/ws" || fail "ws module required at $WS_NODE_PATH (npm install ws in /tmp/export-smoke-node)"

echo "==> typecheck"
./node_modules/.bin/tsc --noEmit
ok "typecheck"

echo "==> focused export/share tests"
node --test modules/app-core/export/export.test.mjs modules/app-core/export/shareExport.test.mjs
ok "focused tests"

echo "==> full serialized test suite"
mapfile -t TEST_FILES < <(node -e \
  "const s=require('./package.json').scripts.test.split(' '); console.log(s.filter(x=>x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0 || fail "could not read package test files"
node --test --test-concurrency=1 "${TEST_FILES[@]}"
ok "full test suite"

echo "==> bundle webExport for browser harness"
mkdir -p modules/app-core/export/.smoke "$DOWNLOAD_DIR"
./node_modules/.bin/esbuild modules/app-core/export/webExport.ts \
  --bundle --platform=browser --format=esm \
  --outfile=modules/app-core/export/.smoke/webExport.browser.js
test -f modules/app-core/export/.smoke/index.html || fail "missing smoke harness html"

# Chrome download prefs. Do not allow automatic multiple downloads: each file
# must be initiated by its own user action.
mkdir -p "$TMP_DIR/chrome-profile/Default"
cat > "$TMP_DIR/chrome-profile/Default/Preferences" <<PREF
{
  "download": {
    "default_directory": "$DOWNLOAD_DIR",
    "prompt_for_download": false,
    "directory_upgrade": true
  },
  "profile": { "default_content_setting_values": { "automatic_downloads": 2 } }
}
PREF

echo "==> serve harness"
python3 -m http.server "$PORT" --directory modules/app-core/export/.smoke >"$TMP_DIR/http.log" 2>&1 &
SERVER_PID="$!"
for _ in {1..40}; do
  curl --fail --silent "$BASE_URL/index.html" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --fail --silent "$BASE_URL/index.html" >/dev/null || fail "harness server not ready"

echo "==> Chrome + CDP download capture"
DEBUG_PORT=$((PORT + 1000))
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --user-data-dir="$TMP_DIR/chrome-profile" \
  --remote-debugging-port="$DEBUG_PORT" \
  --no-first-run \
  --disable-popup-blocking \
  about:blank >"$TMP_DIR/chrome.log" 2>&1 &
CHROME_PID="$!"
for _ in {1..40}; do
  curl --fail --silent "http://127.0.0.1:$DEBUG_PORT/json/version" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --fail --silent "http://127.0.0.1:$DEBUG_PORT/json/version" >/dev/null || fail "Chrome CDP not ready"

DOWNLOAD_DIR="$DOWNLOAD_DIR" BASE_URL="$BASE_URL" DEBUG_PORT="$DEBUG_PORT" NODE_PATH="$WS_NODE_PATH" node <<'NODE'
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const debugPort = process.env.DEBUG_PORT;
const baseUrl = process.env.BASE_URL;
const downloadDir = process.env.DOWNLOAD_DIR;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const version = await getJson('http://127.0.0.1:' + debugPort + '/json/version');
  const browserWsUrl = version.webSocketDebuggerUrl;
  const targets = await getJson('http://127.0.0.1:' + debugPort + '/json/list');
  const page = targets.find((t) => t.type === 'page') || targets[0];
  if (!page?.webSocketDebuggerUrl) throw new Error('no CDP page target');

  function connect(url) {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const api = {
      ws,
      send(method, params = {}, sessionId) {
        return new Promise((resolve, reject) => {
          const msgId = ++id;
          pending.set(msgId, { resolve, reject });
          const payload = { id: msgId, method, params };
          if (sessionId) payload.sessionId = sessionId;
          ws.send(JSON.stringify(payload));
        });
      },
    };
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
    return new Promise((resolve, reject) => {
      ws.on('open', () => resolve(api));
      ws.on('error', reject);
    });
  }

  const browser = await connect(browserWsUrl);
  await browser.send('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: downloadDir,
    eventsEnabled: true,
  }).catch(async () => {
    await browser.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
    });
  });

  const pageApi = await connect(page.webSocketDebuggerUrl);
  await pageApi.send('Page.enable');
  await pageApi.send('Runtime.enable');
  await pageApi.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
  }).catch(() => {});

  await pageApi.send('Page.navigate', { url: baseUrl + '/index.html' });
  for (let i = 0; i < 50; i++) {
    const { result } = await pageApi.send('Runtime.evaluate', {
      expression: 'document.title',
      returnByValue: true,
    });
    if (result?.value === 'export-ready') break;
    await sleep(100);
  }

  const evalResult = await pageApi.send('Runtime.evaluate', {
    expression: 'window.__exportSmoke()',
    awaitPromise: true,
    returnByValue: true,
  });
  if (evalResult.exceptionDetails) {
    throw new Error('export smoke threw: ' + JSON.stringify(evalResult.exceptionDetails));
  }
  const value = evalResult.result?.value;
  if (!value?.ok) throw new Error('export failed: ' + JSON.stringify(value));
  if (value.method !== 'browser-download') throw new Error('expected download fallback: ' + JSON.stringify(value));

  for (const format of ['json', 'csv']) {
    const downloadResult = await pageApi.send('Runtime.evaluate', {
      expression: `window.__downloadSmoke(${JSON.stringify(format)})`,
      userGesture: true,
      returnByValue: true,
    });
    if (downloadResult.exceptionDetails || !downloadResult.result?.value?.ok) {
      throw new Error(format + ' download failed: ' + JSON.stringify(downloadResult));
    }
    await sleep(200);
  }

  // Poll for the two independently initiated downloads.
  let files = [];
  for (let i = 0; i < 30; i++) {
    files = fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload')) : [];
    if (files.includes('macro-tracker-export-smoke.json') && files.includes('macro-tracker-export-smoke.csv')) break;
    await sleep(200);
  }

  {
    const jsonName = 'macro-tracker-export-smoke.json';
    const csvName = 'macro-tracker-export-smoke.csv';
    if (!files.includes(jsonName) || !files.includes(csvName)) {
      throw new Error('missing downloads; saw=' + JSON.stringify(files) + ' method=' + value.method);
    }
    const json = fs.readFileSync(path.join(downloadDir, jsonName), 'utf8');
    const csv = fs.readFileSync(path.join(downloadDir, csvName), 'utf8');
    if (!json.includes('smoke-profile')) throw new Error('json content mismatch');
    if (!csv.includes('smoke-profile')) throw new Error('csv content mismatch');
    console.log('downloads ok via', value.method);
  }

  pageApi.ws.close();
  browser.ws.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE

ok "browser downloads captured"

RESULT="$ROOT/out/issue-78-smoke-result.txt"
mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-78 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git -C "$ROOT" rev-parse HEAD)"
  echo "browser downloads: macro-tracker-export-smoke.json + .csv validated"
} >"$RESULT"
ok "wrote $RESULT"
