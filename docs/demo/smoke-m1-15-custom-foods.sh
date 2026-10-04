#!/usr/bin/env bash
# M1-15 smoke: Custom-food create/edit/archive — macros, barcode, snapshot immutability.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

CF="modules/diary/custom-food"
UD="modules/app-core/user-data"

test -f "$UD/barcode.ts" || fail "missing barcode.ts"
test -f "$UD/customFoodRepo.ts" || fail "missing customFoodRepo.ts"
test -f "$CF/validateDraft.ts" || fail "missing validateDraft"
test -f "$CF/saveCustomFood.ts" || fail "missing saveCustomFood"
test -f "$CF/CustomFoodEditorSheet.tsx" || fail "missing CustomFoodEditorSheet"
test -f "$CF/custom-food.test.mjs" || fail "missing custom-food tests"
test -f "$CF/index.ts" || fail "missing custom-food index"
test -f app/\(tabs\)/food-entry.tsx || fail "missing Search screen"

rg -n "CustomFoodEditorSheet|Create custom food|openEditCustom|saveCustomFoodCreate" app/\(tabs\)/food-entry.tsx >/dev/null \
  || fail "Search missing custom-food create/edit wiring"
rg -n "validateAndNormalizeBarcode|updateCustomFood|archiveCustomFood" "$UD/index.ts" >/dev/null \
  || fail "user-data index missing barcode/update/archive exports"
rg -n "CustomFoodEditorSheet|saveCustomFoodCreate" modules/diary/index.ts >/dev/null \
  || fail "diary index missing custom-food exports"

# Edit path must update custom_food only — diary snapshots stay in diary_entry
rg -n "updateDiaryEntryNutrition|nutrition_snapshot" "$CF" >/dev/null \
  && fail "custom-food must not rewrite diary nutrition snapshots" || true
ok "custom-food does not touch diary snapshots"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> custom-food tests"
node --test "$CF/custom-food.test.mjs"
ok "custom-food tests"

echo "==> npm test (full suite)"
rm -rf modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock 2>/dev/null || true
npm test
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-15-custom-foods PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-57-smoke-result.txt"
