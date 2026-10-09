#!/usr/bin/env bash
# M1-22 smoke: theme/provider refreshes must not create or mutate diary rows.
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
rg -n "quickAddLockedRef|intentId" "app/(tabs)/food-entry.tsx" >/dev/null \
  || fail "quick-add double-press guard missing"
rg -n "Bananas, raw|loadUserDataProviderState|exportBytes|entryCount" "$TEST" >/dev/null \
  || fail "theme/provider/reload diary-invariance coverage missing"
node -e "const p=require('./package.json'); if (!p.scripts.test.includes('$TEST')) process.exit(1)" \
  || fail "focused test missing from package.json test script"
ok "issue #71 implementation and regression coverage present"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> focused issue #71 tests"
node --test "$TEST" modules/diary/favorites-recents/favorites-recents.test.mjs
ok "theme/diary invariance, replay, and quick-add idempotency tests"

echo "==> full serialized test suite"
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "full test suite"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-71 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "coverage: Node theme/provider invariance + food-detail/quick-add intent replay"
  echo "note: production Expo web UI smoke deferred until #73 absolute sql.js WASM URL lands"
} | tee "$ROOT/out/issue-71-smoke-result.txt"
