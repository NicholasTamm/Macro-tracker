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
  modules/diary/food-detail/logFoodEntry.ts >/dev/null \
  || fail "food-log replay guards missing"
rg -n "Bananas, raw|loadUserDataProviderState|exportBytes|entryCount" "$TEST" >/dev/null \
  || fail "theme/provider/reload diary-invariance coverage missing"
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

echo "==> full serialized test suite"
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "full test suite"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-71 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "web persistence: sql.js export/reopen retained the same raw diary rows and Today count"
} | tee "$ROOT/out/issue-71-smoke-result.txt"
