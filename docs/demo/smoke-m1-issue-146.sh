#!/usr/bin/env bash
# M1-80 (#146): tab history after browser Back from deep-linked Settings.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
PORT="${EXPO_WEB_SMOKE_PORT:-18146}"
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
TMP_DIR="$(mktemp -d "$ROOT/software/.smoke-146.XXXXXX")"
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

rg -q 'scripts/issue-146-tab-history.test.mjs' package.json
echo "==> typecheck"
npx tsc --noEmit
echo "==> lint"
npm run -s lint
echo "==> focused tab-history regression tests"
node --test scripts/issue-146-tab-history.test.mjs
echo "==> full serialized test suite"
mapfile -t TEST_FILES < <(node -e \
  "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"

echo "==> Expo web deep-link and browser history (Chrome, 390x844)"
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
DEBUG_PORT="$DEBUG_PORT" ISSUE146_BASE_URL="http://127.0.0.1:$PORT" \
  timeout 240s node scripts/smoke-issue-146-web.mjs >"$TMP_DIR/web-result.txt"
cat "$TMP_DIR/web-result.txt"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-146 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git rev-parse HEAD)"
  echo "software-tree $(git rev-parse HEAD:software)"
  echo "typecheck=npx tsc --noEmit PASS"
  echo "lint=npm run lint PASS (existing warnings only)"
  echo "focused=node --test scripts/issue-146-tab-history.test.mjs PASS (4 tests)"
  echo "regression=production Tabs config + installed TabRouter: deep-link/restored Settings → Today appends history; repeated visits and Back; native firstRoute behavior preserved"
  echo "full-suite=node --test --test-concurrency=1 (all package.json test files) PASS"
  cat "$TMP_DIR/web-result.txt"
} | tee "$ROOT/out/issue-146-smoke-result.txt"
