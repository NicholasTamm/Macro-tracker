#!/usr/bin/env bash
# Issue #12 smoke demo: build tiny FoodSeed from DDL + fixture, query it,
# and print nutrient IDs / schema version from the TypeScript contract.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_DIR="$(cd "$DEMO_DIR/.." && pwd)"
SOFTWARE_DIR="$(cd "$MODULE_DIR/../.." && pwd)"
SMOKE_TEMP_ROOT="${TMPDIR:-/tmp}"
SMOKE_DIR="$(mktemp -d "${SMOKE_TEMP_ROOT%/}/food-catalog-smoke.XXXXXX")"
DB="$SMOKE_DIR/FoodSeed-demo.sqlite"
USER_DB="$SMOKE_DIR/UserData-demo.sqlite"
SCHEMA="$MODULE_DIR/schema/food-seed-v1.sql"
FIXTURE="$DEMO_DIR/fixture-seed.sql"
USER_SCHEMA="$MODULE_DIR/schema/user-store-v1.sql"

cleanup() { rm -rf "$SMOKE_DIR"; }
trap cleanup EXIT

expect_sql_failure() {
  local database="$1"
  local statement="$2"
  if sqlite3 "$database" "$statement" >/dev/null 2>&1; then
    echo "Expected SQLite constraint failure, but statement succeeded" >&2
    exit 1
  fi
}

echo "==> [1/4] Create FoodSeed from food-seed-v1.sql + fixture"
command -v sqlite3 >/dev/null || { echo "sqlite3 required"; exit 1; }
sqlite3 "$DB" < "$SCHEMA"
sqlite3 "$DB" < "$FIXTURE"
INTEGRITY="$(sqlite3 "$DB" "PRAGMA integrity_check;")"
FK_ERRORS="$(sqlite3 "$DB" "PRAGMA foreign_key_check;")"
COUNT="$(sqlite3 "$DB" "SELECT COUNT(*) FROM food;")"
NAME="$(sqlite3 "$DB" "SELECT description FROM food WHERE food_id='usda-foundation:demo-egg';")"
KCAL="$(sqlite3 "$DB" "SELECT amount_per_100g FROM food_nutrient WHERE food_id='usda-foundation:demo-egg' AND nutrient_id='energy_kcal';")"
FTS="$(sqlite3 "$DB" "SELECT food_id FROM food_fts WHERE food_fts MATCH 'egg' LIMIT 1;")"
FTS_COUNT="$(sqlite3 "$DB" "SELECT COUNT(*) FROM food_fts;")"
MISSING_MACROS="$(sqlite3 "$DB" "SELECT COUNT(*) FROM food AS f CROSS JOIN (SELECT 'energy_kcal' AS id UNION ALL SELECT 'protein' UNION ALL SELECT 'carbohydrate' UNION ALL SELECT 'fat_total') AS required LEFT JOIN food_nutrient AS n ON n.food_id=f.food_id AND n.nutrient_id=required.id WHERE n.food_id IS NULL;")"
BAD_DEFAULTS="$(sqlite3 "$DB" "SELECT COUNT(*) FROM food AS f LEFT JOIN serving AS s ON s.serving_id=f.default_serving_id AND s.food_id=f.food_id AND s.is_default=1 WHERE f.default_serving_id IS NOT NULL AND s.serving_id IS NULL;")"
echo "    foods=$COUNT description=$NAME energy_kcal/100g=$KCAL fts_hit=$FTS"
echo "    integrity=$INTEGRITY fk_errors=${FK_ERRORS:-none} fts_documents=$FTS_COUNT missing_macros=$MISSING_MACROS bad_defaults=$BAD_DEFAULTS"
test "$INTEGRITY" = "ok"
test -z "$FK_ERRORS"
test "$COUNT" = "1"
test "$FTS" = "usda-foundation:demo-egg"
test "$FTS_COUNT" = "$COUNT"
test "$MISSING_MACROS" = "0"
test "$BAD_DEFAULTS" = "0"
expect_sql_failure "$DB" "INSERT INTO serving(food_id,sequence,quantity,unit,gram_weight,is_default) VALUES('usda-foundation:demo-egg',2,1,'extra',25,1);"

echo "==> [2/4] Create empty UserData from user-store-v1.sql"
sqlite3 "$USER_DB" < "$USER_SCHEMA"
sqlite3 "$USER_DB" "INSERT INTO schema_meta(key,value) VALUES('user_store_schema_version','1');"
expect_sql_failure "$USER_DB" "INSERT INTO custom_food(id,name,barcode_gtin14,basis_kind,basis_amount,basis_unit,nutrients_json,created_at,updated_at) VALUES('bad-gtin','Bad GTIN','0000000000000x','mass',100,'g','{}','2026-09-28T00:00:00Z','2026-09-28T00:00:00Z');"
expect_sql_failure "$USER_DB" "INSERT INTO remote_food_cache(cache_key,provider,external_id,fetched_at,persistence_policy,last_accessed_at) VALUES('missing-expiry','off','demo','2026-09-28T00:00:00Z','expires','2026-09-28T00:00:00Z');"
UV="$(sqlite3 "$USER_DB" "SELECT value FROM schema_meta WHERE key='user_store_schema_version';")"
USER_INTEGRITY="$(sqlite3 "$USER_DB" "PRAGMA integrity_check;")"
echo "    user_store_schema_version=$UV integrity=$USER_INTEGRITY constraints=ok"
test "$UV" = "1"
test "$USER_INTEGRITY" = "ok"

echo "==> [3/4] TypeScript contract (nutrient IDs + schema version)"
cd "$SOFTWARE_DIR"
if [[ ! -d node_modules ]]; then
  echo "    npm ci (first run)…"
  npm ci --silent
fi

# Emit food-catalog only to a temp dir and assert contract values.
npx tsc --pretty false \
  --strict --esModuleInterop --skipLibCheck \
  --module commonjs --moduleResolution node --target es2020 \
  --rootDir modules/food-catalog \
  --outDir "$SMOKE_DIR/js" \
  modules/food-catalog/nutrients.ts \
  modules/food-catalog/types.ts \
  modules/food-catalog/module.ts \
  modules/food-catalog/index.ts

node << NODE
const n = require("$SMOKE_DIR/js/nutrients.js");
const m = require("$SMOKE_DIR/js/module.js");
console.log("    catalogSchemaVersion=", n.CATALOG_SCHEMA_VERSION);
console.log("    module=", JSON.stringify(m.FoodCatalogModule));
console.log("    required=", n.REQUIRED_NUTRIENT_IDS.join(","));
console.log("    nutrientCount=", n.NUTRIENT_SPECS.length);
if (n.CATALOG_SCHEMA_VERSION !== 1) process.exit(1);
if (n.REQUIRED_NUTRIENT_IDS.length !== 4) process.exit(1);
if (n.NUTRIENT_SPECS.length < 30) process.exit(1);
NODE

echo "==> [4/4] Strict tsc on food-catalog contract sources (scoped; pre-existing app TS errors excluded)"
# Re-run with noEmit equivalent already done via emit above; confirm .js artifacts exist.
test -f "$SMOKE_DIR/js/nutrients.js"
test -f "$SMOKE_DIR/js/types.js"
test -f "$SMOKE_DIR/js/module.js"
echo "    food-catalog emit OK"

echo
echo "SMOKE OK — FoodSeed fixture + UserData DDL + TS contract"
echo "Demo artifacts are removed on exit: $DB , $USER_DB"
