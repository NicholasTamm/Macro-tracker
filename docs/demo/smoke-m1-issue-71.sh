#!/usr/bin/env bash
# M1-22 smoke: theme changes cannot create, duplicate, restore, or mutate diary rows.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

TEST="scripts/issue-71-theme-diary-invariance.test.mjs"
test -f "$TEST" || fail "missing issue #71 regression test"
test -f components/userDataState.ts || fail "missing provider-state reader"
rg -n "intentId|submitLockedRef" modules/diary/food-detail/FoodDetailSheet.tsx \
  modules/diary/food-detail/logFoodEntry.ts modules/diary/favorites-recents/quickAdd.ts >/dev/null \
  || fail "food-log replay guards missing"
rg -n "Bananas, raw|loadUserDataProviderState|exportBytes|entryCount" "$TEST" >/dev/null \
  || fail "theme/provider/reload diary-invariance coverage missing"
test -f scripts/issue-71-web-smoke.mjs || fail "missing production web UI smoke"
node -e "const p=require('./package.json'); if (!p.scripts.test.includes('$TEST')) process.exit(1)" \
  || fail "focused test missing from package.json test script"
ok "issue #71 implementation and regression coverage present"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> focused issue #71 tests"
node --test "$TEST"
ok "theme/diary invariance and replay tests"

echo "==> production web UI smoke"
WEB_PORT=18171
WEB_LOG="$(mktemp)"
CI=1 npx expo start --web --port "$WEB_PORT" >"$WEB_LOG" 2>&1 &
EXPO_PID=$!
cleanup_web() {
  kill "$EXPO_PID" 2>/dev/null || true
  wait "$EXPO_PID" 2>/dev/null || true
  rm -f "$WEB_LOG"
}
trap cleanup_web EXIT
for _ in $(seq 1 120); do
  if curl --silent --fail "http://127.0.0.1:$WEB_PORT" >/dev/null; then break; fi
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    cat "$WEB_LOG" >&2
    fail "Expo web server exited before becoming ready"
  fi
  sleep 1
done
curl --silent --fail "http://127.0.0.1:$WEB_PORT" >/dev/null \
  || { cat "$WEB_LOG" >&2; fail "Expo web server did not become ready"; }
node scripts/issue-71-web-smoke.mjs "http://127.0.0.1:$WEB_PORT"
ok "settings UI/theme provider/Today/browser-reload diary invariance"
cleanup_web
trap - EXIT

echo "==> full serialized test suite"
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "full test suite"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-71 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "web UI: settings save, ThemeProvider rerender, Today revisit, and browser reload preserved one banana row"
} | tee "$ROOT/out/issue-71-smoke-result.txt"
