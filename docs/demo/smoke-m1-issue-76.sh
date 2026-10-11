#!/usr/bin/env bash
# M1-27 smoke: onboarding seed, Analytics navigation, and dated weight persistence.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOFTWARE="$ROOT/software"
PORT="${WEIGHT_SMOKE_PORT:-18076}"
DEBUG_PORT=$((PORT + 1000))
BASE_URL="http://127.0.0.1:$PORT"
TMP_DIR="$(mktemp -d)"
SERVER_PID=""
CHROME_PID=""
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"

cleanup() {
  if [[ -n "$CHROME_PID" ]] && kill -0 "$CHROME_PID" 2>/dev/null; then
    kill "$CHROME_PID" 2>/dev/null || true
    wait "$CHROME_PID" 2>/dev/null || true
  fi
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  if [[ -f "$TMP_DIR/expo.log" ]]; then
    echo "--- Expo log tail ---" >&2
    tail -80 "$TMP_DIR/expo.log" >&2
  fi
  exit 1
}
ok() { echo "OK: $*"; }

test -n "$CHROME" || fail "Chrome is required for the browser smoke"
test -d "$SOFTWARE/node_modules/ws" || fail "the installed dependency tree is missing ws"

# Expo Router resolves dependency symlinks to their owning worktree, which can
# point route discovery at the wrong app. Stage hard-linked dependencies when
# this checkout intentionally shares node_modules with another worktree.
RUNTIME_SOFTWARE="$SOFTWARE"
if [[ -L "$SOFTWARE/node_modules" ]]; then
  RUNTIME_SOFTWARE="$TMP_DIR/software"
  mkdir -p "$RUNTIME_SOFTWARE"
  cp -a "$SOFTWARE/." "$RUNTIME_SOFTWARE/"
  rm "$RUNTIME_SOFTWARE/node_modules"
  cp -al "$(readlink -f "$SOFTWARE/node_modules")" "$RUNTIME_SOFTWARE/node_modules"
  rm -rf "$RUNTIME_SOFTWARE/.expo"
fi
cd "$RUNTIME_SOFTWARE"
npm run sync-web-wasm >/dev/null

echo "==> Expo web server"
CI=1 setsid npx expo start --web --port "$PORT" --clear \
  >"$TMP_DIR/expo.log" 2>&1 &
SERVER_PID="$!"
for _attempt in {1..240}; do
  if curl --fail --silent "$BASE_URL/" >"$TMP_DIR/root.html" 2>/dev/null; then
    break
  fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "Expo exited before serving web"
  sleep 0.5
done
test -s "$TMP_DIR/root.html" || fail "Expo web document did not become ready"
ok "Expo web document ready"

echo "==> Chrome onboarding-to-Analytics flow"
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --user-data-dir="$TMP_DIR/chrome-profile" \
  --remote-debugging-port="$DEBUG_PORT" \
  --no-first-run \
  about:blank >"$TMP_DIR/chrome.log" 2>&1 &
CHROME_PID="$!"
for _attempt in {1..80}; do
  curl --fail --silent "http://127.0.0.1:$DEBUG_PORT/json/version" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --fail --silent "http://127.0.0.1:$DEBUG_PORT/json/version" >/dev/null \
  || fail "Chrome DevTools endpoint did not become ready"

BASE_URL="$BASE_URL" DEBUG_PORT="$DEBUG_PORT" NODE_PATH="$RUNTIME_SOFTWARE/node_modules" node <<'NODE'
const http = require('http');
const WebSocket = require('ws');

const baseUrl = process.env.BASE_URL;
const debugPort = process.env.DEBUG_PORT;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({
      ws,
      send(method, params = {}) {
        return new Promise((sendResolve, sendReject) => {
          const messageId = ++id;
          pending.set(messageId, { resolve: sendResolve, reject: sendReject });
          ws.send(JSON.stringify({ id: messageId, method, params }));
        });
      },
    }));
    ws.on('error', reject);
  });
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let page;

(async () => {
  const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
  const target = targets.find((candidate) => candidate.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Chrome page target missing');
  page = await connect(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  async function evaluate(expression) {
    const response = await page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || 'browser evaluation failed');
    }
    return response.result?.value;
  }

  async function waitFor(expression, description, attempts = 240) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(125);
    }
    const state = await evaluate(`({ url: location.href, text: document.body.innerText.slice(0, 2000) })`);
    throw new Error(`Timed out waiting for ${description}: ${JSON.stringify(state)}`);
  }

  async function reloadAndWait() {
    const previousTimeOrigin = await evaluate('performance.timeOrigin');
    await page.send('Page.reload', { ignoreCache: true });
    for (let attempt = 0; attempt < 240; attempt++) {
      try {
        const state = await evaluate(`({
          ready: document.readyState === 'complete',
          timeOrigin: performance.timeOrigin,
        })`);
        if (state?.ready && state.timeOrigin !== previousTimeOrigin) return;
      } catch {
        // Navigation briefly destroys the old execution context.
      }
      await sleep(125);
    }
    throw new Error('Timed out waiting for a new document after reload');
  }

  async function click(label) {
    const result = await evaluate(`(() => {
      const element = [...document.querySelectorAll('[aria-label]')]
        .find((candidate) =>
          candidate.getAttribute('aria-label') === ${JSON.stringify(label)} &&
          candidate.getClientRects().length > 0 &&
          !candidate.closest('[aria-hidden="true"]') &&
          candidate.getAttribute('aria-disabled') !== 'true'
        );
      if (!element) return { ok: false, labels: [...document.querySelectorAll('[aria-label]')]
        .map((candidate) => candidate.getAttribute('aria-label')) };
      element.click();
      return { ok: true };
    })()`);
    if (!result?.ok) throw new Error(`Could not click ${label}: ${JSON.stringify(result)}`);
  }

  async function fill(label, value) {
    const result = await evaluate(`(() => {
      const input = document.querySelector('[aria-label=${JSON.stringify(label)}]');
      if (!(input instanceof HTMLInputElement)) return { ok: false, tag: input?.tagName ?? null };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      input.focus();
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, value: input.value };
    })()`);
    if (!result?.ok || result.value !== value) {
      throw new Error(`Could not fill ${label}: ${JSON.stringify(result)}`);
    }
  }

  await page.send('Page.navigate', { url: `${baseUrl}/` });
  await waitFor(`Boolean(document.querySelector('[aria-label="I am 18 or older"]'))`, 'adult gate');
  await click('I am 18 or older');
  await waitFor(`document.body.innerText.includes('Choose your units')`, 'units step');
  await click('Continue');
  await waitFor(`document.body.innerText.includes('Biometrics')`, 'biometrics step');
  await click('Continue');
  await waitFor(`document.body.innerText.includes('Goal and rate')`, 'goal step');
  await click('Continue');
  await waitFor(`document.body.innerText.includes('Safety exclusions')`, 'exclusions step');
  await click('Continue');
  await waitFor(`Boolean(document.querySelector('[aria-label="Finish onboarding"]'))`, 'target step');
  await click('Finish onboarding');
  await waitFor(`Boolean(document.querySelector('[aria-label="Analytics"]'))`, 'tab navigation');
  await click('Analytics');
  await waitFor(`document.body.innerText.includes('Last 30 days')`, 'Analytics screen');

  const todayLabel = await evaluate(`new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })`);
  const onboardingEntry = `70.0 kg on ${todayLabel}`;
  await waitFor(
    `Boolean(document.querySelector('[aria-label=${JSON.stringify(onboardingEntry)}]'))`,
    'onboarding weight entry and displayed date',
  );

  await fill('Weight in kilograms', '68.4');
  await fill('Weight date', '2001-02-03');
  await click('Log weight');
  const historicalDateLabel = await evaluate(`new Date('2001-02-03T12:00:00.000Z')
    .toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    })`);
  const historicalEntry = `68.4 kg on ${historicalDateLabel}`;
  await waitFor(
    `Boolean(document.querySelector('[aria-label=${JSON.stringify(historicalEntry)}]'))`,
    'historical entry submission and displayed date',
  );

  await reloadAndWait();
  await waitFor(
    `Boolean(document.querySelector('[aria-label=${JSON.stringify(onboardingEntry)}]')) &&
      Boolean(document.querySelector('[aria-label=${JSON.stringify(historicalEntry)}]'))`,
    'persisted Analytics entries after reload',
  );

  await click(`Delete ${onboardingEntry}`);
  await waitFor(
    `document.body.innerText.includes('No recent weights') &&
      !document.body.innerText.includes('No weights yet') &&
      Boolean(document.querySelector('[aria-label=${JSON.stringify(historicalEntry)}]'))`,
    'historical-only empty-chart state',
  );

  await reloadAndWait();
  await waitFor(
    `document.body.innerText.includes('No recent weights') &&
      Boolean(document.querySelector('[aria-label=${JSON.stringify(historicalEntry)}]'))`,
    'historical-only state after reload',
  );

  console.log(JSON.stringify({ onboardingEntry, historicalEntry }));
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  page?.ws.close();
});
NODE
ok "onboarding seed, Analytics navigation, historical submit/reload/date display, and historical-only state"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-76 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git -C "$ROOT" rev-parse HEAD)"
  echo "browser onboarding -> Analytics: 70.0 kg onboarding sample displayed"
  echo "browser historical entry: 68.4 kg on local date 2001-02-03 persisted across reload"
  echo "browser historical-only state: No recent weights; historical entry retained after reload"
} | tee "$ROOT/out/issue-76-smoke-result.txt"
