#!/usr/bin/env bash
# M1-06 smoke: USDA seed build pipeline on golden fixture (no network).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

SEED="modules/food-catalog/scripts/build-seed"
test -f "$SEED/build-seed.mjs" || fail "missing build-seed.mjs"
test -f "$SEED/pinned-sources.json" || fail "missing pinned-sources.json"
test -f "$SEED/fixture/foundation/food.csv" || fail "missing foundation fixture"
test -f "$SEED/fixture/sr_legacy/food.csv" || fail "missing sr_legacy fixture"
test -f modules/food-catalog/schema/food-seed-v1.sql || fail "missing food-seed-v1.sql"
command -v sqlite3 >/dev/null || fail "sqlite3 CLI required (FTS5 FoodSeed build)"

if [[ ! -d node_modules ]]; then npm ci; fi

OUT="$SEED/out/smoke"
rm -rf "$OUT"

echo "==> unit tests (checksum + normalize + emit)"
node --test "$SEED/build-seed.test.mjs"
ok "build-seed unit tests"

echo "==> build-seed.mjs (fixture mode)"
node "$SEED/build-seed.mjs" --out "$OUT" --seed-version "smoke.m1-06.1"
test -f "$OUT/FoodSeed.sqlite" || fail "FoodSeed.sqlite not written"
test -f "$OUT/build-manifest.json" || fail "build-manifest.json not written"

FOODS="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM food;')"
FTS="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM food_fts;')"
TYPED="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM food WHERE data_type IN ('foundation','sr_legacy');")"
SRC_HASH="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM source WHERE length(archive_sha256)=64;')"
EGG="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT amount_per_100g FROM food_nutrient WHERE food_id='usda-foundation:748967' AND nutrient_id='energy_kcal';")"
FTS_HIT="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT food_id FROM food_fts WHERE food_fts MATCH 'egg' LIMIT 1;")"
MANIFEST_FOODS="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/build-manifest.json','utf8')).content.foodCount)")"
MANIFEST_HASH="$(node -e "const m=JSON.parse(require('fs').readFileSync('$OUT/build-manifest.json','utf8')); if(!m.sources.every(s=>/^[0-9a-f]{64}$/.test(s.archiveSHA256))) process.exit(1); console.log(m.sources[0].archiveSHA256.slice(0,12));")"

echo "    foods=$FOODS fts=$FTS typed=$TYPED sources_with_hash=$SRC_HASH egg_kcal=$EGG fts_hit=$FTS_HIT manifest_foods=$MANIFEST_FOODS pin=${MANIFEST_HASH}…"

test "$FOODS" = "$FTS" || fail "fts parity"
test "$FOODS" = "$TYPED" || fail "data_type filter"
test "$SRC_HASH" -ge 1 || fail "source archive_sha256"
test "$EGG" = "148.0" -o "$EGG" = "148" || fail "egg energy_kcal"
test "$FTS_HIT" = "usda-foundation:748967" || fail "fts egg hit"
test "$MANIFEST_FOODS" = "$FOODS" || fail "manifest foodCount"
ok "fixture pipeline + sqlite checks"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-06-seed-build PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "mode=fixture foods=$FOODS"
  echo "manifest=$OUT/build-manifest.json"
  echo "one-command: cd software && node modules/food-catalog/scripts/build-seed/build-seed.mjs"
  echo "full USDA (optional): USE_FULL_USDA=1 node modules/food-catalog/scripts/build-seed/build-seed.mjs"
} | tee "$ROOT/out/issue-35-smoke-result.txt"

ok "smoke-m1-06-seed-build"
