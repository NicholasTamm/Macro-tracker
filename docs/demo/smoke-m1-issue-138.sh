#!/usr/bin/env bash
# M1-72 (#138): metric food detail defaults and remembered quick-add amounts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

DETAIL="modules/diary/food-detail"
rg -q 'defaultQuantity.test.mjs' package.json
# Both UI and quick-add must consume the model default before applying history.
rg -q 'String\(model.suggestedQuantity\)' "$DETAIL/FoodDetailSheet.tsx"
rg -q 'recent.lastQuantity' "$DETAIL/FoodDetailSheet.tsx"
rg -q 'selectionFromRememberedUnit\(model, recent.lastUnit\)' "$DETAIL/FoodDetailSheet.tsx"
rg -q 'recent\?\.lastQuantity \?\? model.suggestedQuantity' modules/diary/favorites-recents/quickAdd.ts

echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused default quantity, food detail, and favorites/recents tests'
node --test --test-concurrency=1 "$DETAIL/defaultQuantity.test.mjs" \
  "$DETAIL/food-detail.test.mjs" modules/diary/favorites-recents/favorites-recents.test.mjs

echo '==> full serialized test suite from package.json'
mapfile -t TEST_FILES < <(node -e \
  "console.log(require('./package.json').scripts.test.split(' ').filter(x => x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-138 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Code commit: $(git rev-parse HEAD)"
  echo 'PASS: typecheck; lint; focused tests; full suite with --test-concurrency=1.'
  echo 'PASS: fixture chicken (28.35 g/oz), egg (50.3 g/egg), rice (195 g/cup), banana (225 g/cup) default to 100 g in metric.'
  echo 'PASS: no-portion seed and weighable custom foods use 100 g; custom foods without grams retain their serving.'
  echo 'PASS: imperial serving defaults preserved; favorite quick-add without history uses 100 g; remembered grams and ounce quantities win.'
  echo 'Web manual check: metric profile -> Food entry -> search chicken breast -> open cooked, roasted -> Quantity 100, Grams selected. Log a different quantity/unit, reopen, and verify it is remembered.'
  echo 'Browser execution is separate from this model/store smoke; record any completed browser verification below.'
} > "$ROOT/out/issue-138-smoke-result.txt"
echo 'OK: wrote out/issue-138-smoke-result.txt'
