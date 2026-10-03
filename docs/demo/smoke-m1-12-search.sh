#!/usr/bin/env bash
# M1-12 smoke: Search — Recent/Favorites/My Foods + local FTS (debounce/cancel, source/per-100g, a11y).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

SEARCH="modules/food-catalog/search"
ASSET="modules/food-catalog/assets/FoodSeed.fixture.sqlite"

test -f "$SEARCH/debounce.ts" || fail "missing debounce.ts"
test -f "$SEARCH/formatResultDetail.ts" || fail "missing formatResultDetail.ts"
test -f "$SEARCH/enrichHits.ts" || fail "missing enrichHits.ts"
test -f "$SEARCH/searchController.ts" || fail "missing searchController.ts"
test -f "$SEARCH/browseSections.ts" || fail "missing browseSections.ts"
test -f "$SEARCH/a11ySummary.ts" || fail "missing a11ySummary.ts"
test -f "$SEARCH/search.test.mjs" || fail "missing search.test.mjs"
test -f "$ASSET" || fail "missing fixture seed asset"
test -f app/\(tabs\)/food-entry.tsx || fail "missing Search screen (food-entry.tsx)"
test -f components/FoodCatalogProvider.tsx || fail "missing FoodCatalogProvider"
test -f modules/app-core/user-data/favoriteRepo.ts || fail "missing favoriteRepo"
test -f modules/app-core/user-data/recentFoodRepo.ts || fail "missing recentFoodRepo"
test -f metro.config.js || fail "missing metro.config.js (sqlite assetExts)"

# M1-12 originally deferred detail sheet; M1-13 may wire FoodDetailSheet here.
# Keep verifying Search cancel/controller wiring below.
ok "Search screen may include M1-13 FoodDetailSheet"

# Guard: do not edit Today / diary entry screens in this PR path check (files may exist from #49)
# Soft check: food-entry should mention Cancel + a11y summary helpers
rg -n "Cancel search|formatSearchA11ySummary|createSearchController|buildBrowseSections" app/\(tabs\)/food-entry.tsx >/dev/null \
  || fail "Search screen missing cancel/a11y/controller wiring"
ok "Search screen wiring"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing (npm ci)"
test -d node_modules/node-sqlite3-wasm || fail "node-sqlite3-wasm missing (npm ci)"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> search unit tests (debounce/cancel, enrich, ranking, browse, a11y)"
node --test "$SEARCH/search.test.mjs"
ok "search tests"

echo "==> npm test (full suite)"
npm test
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-12-search PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-50-smoke-result.txt"
