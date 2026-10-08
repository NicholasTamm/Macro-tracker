#!/usr/bin/env bash
# M1-24 smoke: route-independent sql.js WASM resolution on Expo web.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOFTWARE="$ROOT/software"
PORT="${EXPO_WEB_SMOKE_PORT:-18073}"
BASE_URL="http://127.0.0.1:$PORT"
TMP_DIR="$(mktemp -d)"
SERVER_PID=""
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
cd "$SOFTWARE"

cleanup() {
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

for file in \
  modules/sqlite/sqlJs.ts \
  modules/sqlite/sqlJs.test.mjs \
  modules/app-core/user-data/openSqlJs.ts \
  modules/food-catalog/local-food-repo/openSeed.ts; do
  test -f "$file" || fail "missing $file"
done
rg -n "modules/sqlite/sqlJs\.test\.mjs" package.json >/dev/null \
  || fail "package test script missing sql.js URL regression tests"
test -n "$CHROME" || fail "Chrome is required for direct-route network assertions"
npm run sync-web-wasm
ok "shared resolver, regression tests, and WASM asset present"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> focused sql.js URL tests"
node --test modules/sqlite/sqlJs.test.mjs
ok "focused tests"

echo "==> full serialized test suite"
mapfile -t TEST_FILES < <(node -e \
  "const s=require('./package.json').scripts.test.split(' '); console.log(s.filter(x=>x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0 || fail "could not read package test files"
node --test --test-concurrency=1 "${TEST_FILES[@]}"
ok "full test suite"

echo "==> Expo web direct-route checks"
CI=1 setsid npx expo start --web --port "$PORT" --clear >"$TMP_DIR/expo.log" 2>&1 &
SERVER_PID="$!"
for _attempt in {1..240}; do
  if curl --fail --silent --show-error "$BASE_URL/" >"$TMP_DIR/root.html" 2>/dev/null; then
    break
  fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "Expo exited before serving web"
  sleep 0.5
done
test -s "$TMP_DIR/root.html" || fail "Expo web document did not become ready"

assert_direct_route() {
  local name="$1"
  local route="$2"
  local profile="$3"
  local netlog="$TMP_DIR/$name.netlog.json"
  local dom="$TMP_DIR/$name.dom.html"

  "$CHROME" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --user-data-dir="$profile" \
    --log-net-log="$netlog" \
    --net-log-capture-mode=IncludeSensitive \
    --virtual-time-budget=8000 \
    --dump-dom "$BASE_URL$route" >"$dom" 2>"$TMP_DIR/$name.chrome.log" \
    || fail "Chrome failed to load $route"

  node --input-type=module - "$netlog" "$BASE_URL/sql-wasm-browser.wasm" <<'NODE'
import { readFileSync } from 'node:fs';
const [netlogPath, expected] = process.argv.slice(2);
const netlog = readFileSync(netlogPath, 'utf8');
if (!netlog.includes(expected)) {
  throw new Error(`expected sql.js WASM request missing: ${expected}`);
}
if (/\/settings(?:\/[^"?]*)?\/sql-wasm-browser\.wasm/.test(netlog)) {
  throw new Error('route-relative sql.js WASM request detected');
}
NODE
  rg -n "Aborted\(both async and sync fetching of the wasm failed\)|Unable to initialize (user data|food catalog) storage" "$dom" \
    && fail "sql.js failure UI rendered on $route"
  ok "$route requested only the stable sql.js WASM URL"
}

PROFILE_DIR="$TMP_DIR/chrome-profile"
assert_direct_route root / "$PROFILE_DIR"
assert_direct_route profile-direct /settings/profile "$PROFILE_DIR"
assert_direct_route profile-refresh /settings/profile "$PROFILE_DIR"
assert_direct_route about /settings/about "$PROFILE_DIR"
assert_direct_route licenses /settings/licenses "$PROFILE_DIR"
assert_direct_route privacy /settings/privacy "$PROFILE_DIR"
assert_direct_route units /settings/units "$PROFILE_DIR"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-73 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit=$(git -C "$ROOT" rev-parse --short HEAD)"
  echo "focused=node --test modules/sqlite/sqlJs.test.mjs"
  echo "routes=/,/settings/profile (direct+refresh),/settings/about,/settings/licenses,/settings/privacy,/settings/units"
  echo "wasm-url=$BASE_URL/sql-wasm-browser.wasm"
  echo "web-verification=Chrome net logs contained the stable absolute WASM URL and no route-relative settings WASM request; no sql.js failure UI rendered"
} | tee "$ROOT/out/issue-73-smoke-result.txt"
