#!/usr/bin/env bash
# M1-07 smoke: reviewed selection / aliases / category quotas on golden fixture (no network).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

SEED="modules/food-catalog/scripts/build-seed"
SEL="$SEED/selection"

test -f "$SEL/selection.csv" || fail "missing selection.csv"
test -f "$SEL/aliases-overrides.csv" || fail "missing aliases-overrides.csv"
test -f "$SEL/category-quotas.json" || fail "missing category-quotas.json"
test -f "$SEL/raw-cooked-pairs.csv" || fail "missing raw-cooked-pairs.csv"
test -f "$SEL/README.md" || fail "missing selection README"
test -f "$SEED/lib/selection.mjs" || fail "missing lib/selection.mjs"
test -f "$SEED/fixture/sr_legacy/food.csv" || fail "missing expanded sr_legacy fixture"
command -v sqlite3 >/dev/null || fail "sqlite3 CLI required"

if [[ ! -d node_modules ]]; then npm ci; fi

OUT="$SEED/out/smoke-m1-07"
rm -rf "$OUT"

echo "==> unit tests (selection + build-seed)"
node --test "$SEED/selection.test.mjs" "$SEED/build-seed.test.mjs"
ok "selection + build-seed unit tests"

echo "==> build-seed.mjs (fixture + selection)"
node "$SEED/build-seed.mjs" --out "$OUT" --seed-version "smoke.m1-07.1"
test -f "$OUT/selection-report.json" || fail "selection-report.json not written"
test -f "$OUT/selected-food-ids.json" || fail "selected-food-ids.json not written"
test -f "$OUT/FoodSeed.sqlite" || fail "FoodSeed.sqlite not written"

REPORT_OK="$(node -e "const r=JSON.parse(require('fs').readFileSync('$OUT/selection-report.json','utf8')); if(!r.ok) process.exit(1); console.log(r.selectedCount)")"
QUOTAS_MET="$(node -e "const r=JSON.parse(require('fs').readFileSync('$OUT/selection-report.json','utf8')); console.log(r.quotas.allMet?'yes':'no')")"
PAIRS_OK="$(node -e "const r=JSON.parse(require('fs').readFileSync('$OUT/selection-report.json','utf8')); console.log(r.rawCookedPairs.allOk?'yes':'no')")"
ALIAS_N="$(node -e "const r=JSON.parse(require('fs').readFileSync('$OUT/selection-report.json','utf8')); console.log(r.aliases.appliedCount)")"
SELECTED_N="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/selected-food-ids.json','utf8')).length)")"

FOODS="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM food;')"
QUOTA_ROWS="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM category_quota;')"
ALIAS_REVIEWED="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM alias WHERE alias_type='reviewed';")"
CHICKEN_RAW="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM food WHERE food_id='usda-sr-legacy:171077';")"
CHICKEN_COOKED="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM food WHERE food_id='usda-sr-legacy:171079';")"
CHICKEN_RAW_STATE="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT state FROM food WHERE food_id='usda-sr-legacy:171077';")"
CHICKEN_COOKED_STATE="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT state FROM food WHERE food_id='usda-sr-legacy:171079';")"
BANANA_ALIAS="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM alias WHERE food_id='usda-sr-legacy:173944' AND normalized_alias='banana';")"

echo "    selected=$SELECTED_N foods=$FOODS quotas_met=$QUOTAS_MET pairs=$PAIRS_OK aliases_applied=$ALIAS_N quota_rows=$QUOTA_ROWS reviewed_aliases=$ALIAS_REVIEWED"

test "$SELECTED_N" = "14" || fail "expected 14 selected ids"
test "$FOODS" = "14" || fail "expected 14 foods in sqlite"
test "$QUOTAS_MET" = "yes" || fail "quotas not met"
test "$PAIRS_OK" = "yes" || fail "raw/cooked pairs broken"
test "$CHICKEN_RAW" = "1" || fail "chicken raw missing"
test "$CHICKEN_COOKED" = "1" || fail "chicken cooked missing"
test "$CHICKEN_RAW_STATE" = "raw" || fail "chicken raw state column"
test "$CHICKEN_COOKED_STATE" = "cooked" || fail "chicken cooked state column"
test "$BANANA_ALIAS" -ge 1 || fail "reviewed banana alias missing"
test "$QUOTA_ROWS" -ge 11 || fail "category_quota rows missing"
test "$ALIAS_REVIEWED" -ge 8 || fail "reviewed aliases not emitted"

# Documented full path exists
test -f "$SEL/selection.full.csv.example" || fail "missing selection.full.csv.example"
grep -q 'USE_FULL_USDA' "$SEL/README.md" || fail "README missing USE_FULL_USDA path"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-07-selection PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "mode=fixture selected=$SELECTED_N quotas_met=$QUOTAS_MET pairs=$PAIRS_OK aliases_applied=$ALIAS_N"
  echo "report=$OUT/selection-report.json"
  echo "one-command: cd software && node modules/food-catalog/scripts/build-seed/build-seed.mjs"
  echo "full USDA path: copy selection/selection.full.csv.example → selection.full.csv, then USE_FULL_USDA=1 node …/build-seed.mjs"
} | tee "$ROOT/out/issue-41-smoke-result.txt"

ok "smoke-m1-07-selection"
