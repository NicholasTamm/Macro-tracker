#!/usr/bin/env bash
# M1-23 smoke: clean-install Expo web startup, isolation headers, and SQLite WASM assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOFTWARE="$ROOT/software"
PORT="${EXPO_WEB_SMOKE_PORT:-18072}"
BASE_URL="http://127.0.0.1:$PORT"
TMP_DIR="$(mktemp -d)"
SERVER_PID=""
cd "$SOFTWARE"

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    # Expo runs in its own process group (setsid); stop npx and its node child.
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

assert_isolation_headers() {
  local headers="$1"
  local normalized
  # HTTP header lines end in CRLF; strip CR before anchoring the match.
  normalized="$(tr -d '\r' < "$headers")"
  grep -Eiq '^Cross-Origin-Opener-Policy: same-origin$' <<<"$normalized" \
    || fail "missing COOP same-origin in $headers"
  grep -Eiq '^Cross-Origin-Embedder-Policy: credentialless$' <<<"$normalized" \
    || fail "missing COEP credentialless in $headers"
}

fetch() {
  local name="$1"
  local url="$2"
  curl --fail --silent --show-error \
    --dump-header "$TMP_DIR/$name.headers" \
    --output "$TMP_DIR/$name.body" \
    "$url" \
    || fail "$name did not return HTTP success: $url"
  grep -Eq '^HTTP/[0-9.]+ 200 ' "$TMP_DIR/$name.headers" \
    || fail "$name did not return HTTP 200: $url"
  assert_isolation_headers "$TMP_DIR/$name.headers"
}

for file in metro.config.js scripts/sync-web-wasm.mjs scripts/web-wasm.test.mjs; do
  test -f "$file" || fail "missing $file"
done
rg -n "scripts/web-wasm\.test\.mjs" package.json >/dev/null \
  || fail "package test script missing web WASM regression tests"
rg -n "'sqlite'|'wasm'" metro.config.js >/dev/null \
  || fail "Metro config must register SQLite and WASM assets"
ok "web startup configuration and regression tests present"

echo "==> clean dependency install (generates public/sql-wasm-browser.wasm)"
npm ci
cmp -s \
  node_modules/sql.js/dist/sql-wasm-browser.wasm \
  public/sql-wasm-browser.wasm \
  || fail "public sql.js WASM is missing or stale after npm ci"
ok "public sql.js WASM matches the installed package"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> focused web WASM tests"
node --test scripts/web-wasm.test.mjs
ok "focused tests"

echo "==> full serialized test suite"
mapfile -t TEST_FILES < <(node -e \
  "const s=require('./package.json').scripts.test.split(' '); console.log(s.filter(x=>x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0 || fail "could not read package test files"
node --test --test-concurrency=1 "${TEST_FILES[@]}"
ok "full test suite"

echo "==> Expo web startup"
CI=1 setsid npx expo start --web --port "$PORT" --clear >"$TMP_DIR/expo.log" 2>&1 &
SERVER_PID="$!"

for _attempt in {1..240}; do
  if curl --fail --silent --show-error \
    --dump-header "$TMP_DIR/document.headers" \
    --output "$TMP_DIR/document.body" \
    "$BASE_URL/" 2>/dev/null; then
    break
  fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "Expo exited before serving the web document"
  sleep 0.5
done
grep -Eq '^HTTP/[0-9.]+ 200 ' "$TMP_DIR/document.headers" \
  || fail "Expo web document did not become ready"
assert_isolation_headers "$TMP_DIR/document.headers"
ok "initial web document HTTP 200 with COOP/COEP"

node --input-type=module - "$TMP_DIR/document.body" "$TMP_DIR/entry-url" "$BASE_URL" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const [htmlPath, outputPath, baseUrl] = process.argv.slice(2);
const html = readFileSync(htmlPath, 'utf8');
const path = html.match(/<script[^>]+src="([^"]+entry\.bundle[^"]*)"/)?.[1]
  ?.replaceAll('&amp;', '&');
if (!path) throw new Error('entry bundle URL missing from Expo document');
writeFileSync(outputPath, new URL(path, baseUrl).href);
NODE
ENTRY_URL="$(<"$TMP_DIR/entry-url")"
fetch entry "$ENTRY_URL"
ok "entry bundle HTTP 200 with COOP/COEP"

node --input-type=module - "$TMP_DIR/entry.body" "$TMP_DIR/worker-url" "$BASE_URL" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const [bundlePath, outputPath, baseUrl] = process.argv.slice(2);
const bundle = readFileSync(bundlePath, 'utf8');
const path = bundle.match(/"(\/node_modules\/expo-sqlite\/web\/worker\.bundle\?[^"]+)"/)?.[1];
if (!path) throw new Error('expo-sqlite worker bundle URL missing from entry bundle');
writeFileSync(outputPath, new URL(path, baseUrl).href);
NODE
WORKER_URL="$(<"$TMP_DIR/worker-url")"
fetch worker "$WORKER_URL"
ok "expo-sqlite worker bundle HTTP 200 with COOP/COEP"

node --input-type=module - "$TMP_DIR/worker.body" "$TMP_DIR/expo-wasm-url" "$BASE_URL" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const [workerPath, outputPath, baseUrl] = process.argv.slice(2);
const worker = readFileSync(workerPath, 'utf8');
const path = worker.match(/module\.exports = "([^"]*wa-sqlite\.wasm)"/)?.[1];
if (!path) throw new Error('Expo SQLite WASM URL missing from worker bundle');
writeFileSync(outputPath, new URL(path, baseUrl).href);
NODE
EXPO_WASM_URL="$(<"$TMP_DIR/expo-wasm-url")"
fetch expo-wasm "$EXPO_WASM_URL"
cmp -s "$TMP_DIR/expo-wasm.body" node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.wasm \
  || fail "served Expo SQLite WASM differs from the installed package"
ok "Expo SQLite WASM HTTP 200 and matches the installed package"

fetch sqljs-wasm "$BASE_URL/sql-wasm-browser.wasm"
cmp -s "$TMP_DIR/sqljs-wasm.body" node_modules/sql.js/dist/sql-wasm-browser.wasm \
  || fail "served sql.js WASM differs from the installed package"
ok "sql.js WASM HTTP 200 and matches the installed package"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-72 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit=$(git -C "$ROOT" rev-parse --short HEAD) clean-install=npm ci"
  echo "web-document=$BASE_URL/ HTTP 200 COOP=same-origin COEP=credentialless"
  echo "entry-bundle=$ENTRY_URL HTTP 200"
  echo "expo-sqlite-wasm=$EXPO_WASM_URL HTTP 200 bytes=$(wc -c < "$TMP_DIR/expo-wasm.body")"
  echo "sqljs-wasm=$BASE_URL/sql-wasm-browser.wasm HTTP 200 bytes=$(wc -c < "$TMP_DIR/sqljs-wasm.body")"
  echo "web-verification=Expo web document and browser-consumed entry, worker, and WASM resources returned successfully"
} | tee "$ROOT/out/issue-72-smoke-result.txt"
