#!/usr/bin/env bash
# M1-16 smoke: Favorites, recents, last qty/unit, quick-add.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

FR="modules/diary/favorites-recents"
UD="modules/app-core/user-data"

test -f "$UD/favoriteRepo.ts" || fail "missing favoriteRepo"
test -f "$UD/recentFoodRepo.ts" || fail "missing recentFoodRepo"
test -f "$FR/quickAdd.ts" || fail "missing quickAdd"
test -f "$FR/favorites-recents.test.mjs" || fail "missing favorites-recents tests"
test -f "$FR/index.ts" || fail "missing favorites-recents index"
test -f modules/diary/food-detail/logFoodEntry.ts || fail "missing logFoodEntry"
test -f app/\(tabs\)/food-entry.tsx || fail "missing Search screen"

rg -n "toggleFavorite|addFavorite|recordRecentFood" "$UD/index.ts" >/dev/null \
  || fail "user-data index missing favorite/recent writes"
rg -n "recordRecentFood" modules/diary/food-detail/logFoodEntry.ts >/dev/null \
  || fail "logFoodToDiary must upsert recent_food in-transaction"
rg -n "quickAddFood|Quick-add" app/\(tabs\)/food-entry.tsx >/dev/null \
  || fail "Search missing quick-add wiring"
rg -n "toggleFavorite|getRecentFood|isFavorite" modules/diary/food-detail/FoodDetailSheet.tsx >/dev/null \
  || fail "FoodDetailSheet missing favorite/last-qty wiring"
rg -n "quickAddFood" modules/diary/index.ts >/dev/null \
  || fail "diary index missing quick-add exports"
ok "favorites/recents/quick-add wiring"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> favorites-recents tests"
node --test "$FR/favorites-recents.test.mjs"
ok "favorites-recents tests"

echo "==> npm test (full suite, concurrency 1)"
rm -rf modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock 2>/dev/null || true
node --test --test-concurrency=1 \
  scripts/secret-scan.test.mjs \
  design-system/tokens/tokens.test.mjs \
  design-system/components/__tests__/a11y-targets.test.mjs \
  modules/app-core/user-data/user-data.test.mjs \
  modules/app-core/user-data/onboarding.test.mjs \
  modules/app-core/export/export.test.mjs \
  modules/diary/diary.test.mjs \
  modules/diary/food-detail/food-detail.test.mjs \
  modules/diary/entry-edit/diary-edit.test.mjs \
  modules/diary/custom-food/custom-food.test.mjs \
  modules/diary/favorites-recents/favorites-recents.test.mjs \
  modules/food-catalog/scripts/build-seed/build-seed.test.mjs \
  modules/food-catalog/scripts/build-seed/selection.test.mjs \
  modules/food-catalog/scripts/build-seed/emit-package.test.mjs \
  modules/food-catalog/local-food-repo/local-food-repo.test.mjs \
  modules/food-catalog/search/search.test.mjs
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-16-favorites-recents PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-58-smoke-result.txt"
