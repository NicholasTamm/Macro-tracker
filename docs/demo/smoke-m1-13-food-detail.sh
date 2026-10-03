#!/usr/bin/env bash
# M1-13 smoke: Food detail/log sheet — golden calc, validation, atomic Today log.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

DETAIL="modules/diary/food-detail"

test -f "$DETAIL/parseQuantity.ts" || fail "missing parseQuantity"
test -f "$DETAIL/scaleNutrients.ts" || fail "missing scaleNutrients"
test -f "$DETAIL/resolveAmount.ts" || fail "missing resolveAmount"
test -f "$DETAIL/computeLiveNutrients.ts" || fail "missing computeLiveNutrients"
test -f "$DETAIL/buildFoodDetail.ts" || fail "missing buildFoodDetail"
test -f "$DETAIL/logFoodEntry.ts" || fail "missing logFoodEntry"
test -f "$DETAIL/FoodDetailSheet.tsx" || fail "missing FoodDetailSheet"
test -f "$DETAIL/food-detail.test.mjs" || fail "missing food-detail tests"
test -f "$DETAIL/index.ts" || fail "missing food-detail index"
test -f app/\(tabs\)/food-entry.tsx || fail "missing Search screen"
test -f app/\(tabs\)/today.tsx || fail "missing Today screen"
test -f modules/food-catalog/assets/FoodSeed.fixture.sqlite || fail "missing fixture seed"

# Search wires detail sheet; Today refreshes on focus
rg -n "FoodDetailSheet|buildSeedFoodDetail|openDetail" app/\(tabs\)/food-entry.tsx >/dev/null \
  || fail "Search screen missing food detail wiring"
rg -n "useFocusEffect" app/\(tabs\)/today.tsx >/dev/null \
  || fail "Today screen missing focus reload for atomic log updates"
rg -n "logFoodToDiary|scaleNutrientsPer100g" modules/diary/index.ts >/dev/null \
  || fail "diary index missing food-detail exports"

# Must NOT ship edit/delete/undo UI (M1-14)
if rg -n "undoDiary|editDiaryEntry|deleteEntry\b|UndoSnackbar" "$DETAIL" app/\(tabs\)/food-entry.tsx app/\(tabs\)/today.tsx 2>/dev/null; then
  fail "edit/delete/undo appears to be implemented (belongs to M1-14)"
fi
ok "no M1-14 edit/delete/undo in M1-13 scope"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing"
test -d node_modules/node-sqlite3-wasm || fail "node-sqlite3-wasm missing"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> food-detail golden / validation / atomic tests"
node --test "$DETAIL/food-detail.test.mjs"
ok "food-detail tests"

echo "==> npm test (full suite)"
npm test
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-13-food-detail PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-51-smoke-result.txt"
