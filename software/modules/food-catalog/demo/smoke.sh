#!/usr/bin/env bash
# Issue #12 smoke demo: build tiny FoodSeed from DDL + fixture, query it,
# and print nutrient IDs / schema version from the TypeScript contract.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_DIR="$(cd "$DEMO_DIR/.." && pwd)"
SOFTWARE_DIR="$(cd "$MODULE_DIR/../.." && pwd)"
TMPDIR="${TMPDIR:-/tmp}/food-catalog-smoke-$$"
DB="$TMPDIR/FoodSeed-demo.sqlite"
USER_DB="$TMPDIR/UserData-demo.sqlite"
SCHEMA="$MODULE_DIR/schema/food-seed-v1.sql"
FIXTURE="$DEMO_DIR/fixture-seed.sql"
USER_SCHEMA="$MODULE_DIR/schema/user-store-v1.sql"

cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

mkdir -p "$TMPDIR"

echo "==> [1/4] Create FoodSeed from food-seed-v1.sql + fixture"
command -v sqlite3 >/dev/null || { echo "sqlite3 required"; exit 1; }
sqlite3 "$DB" < "$SCHEMA"
sqlite3 "$DB" < "$FIXTURE"
sqlite3 "$DB" "PRAGMA foreign_key_check;"
COUNT="$(sqlite3 "$DB" "SELECT COUNT(*) FROM food;")"
NAME="$(sqlite3 "$DB" "SELECT description FROM food WHERE food_id='usda-foundation:demo-egg';")"
KCAL="$(sqlite3 "$DB" "SELECT amount_per_100g FROM food_nutrient WHERE food_id='usda-foundation:demo-egg' AND nutrient_id='energy_kcal';")"
FTS="$(sqlite3 "$DB" "SELECT food_id FROM food_fts WHERE food_fts MATCH 'egg' LIMIT 1;")"
echo "    foods=$COUNT description=$NAME energy_kcal/100g=$KCAL fts_hit=$FTS"
test "$COUNT" = "1"
test "$FTS" = "usda-foundation:demo-egg"

echo "==> [2/4] Create empty UserData from user-store-v1.sql"
sqlite3 "$USER_DB" < "$USER_SCHEMA"
sqlite3 "$USER_DB" "INSERT INTO schema_meta(key,value) VALUES('user_store_schema_version','1');"
UV="$(sqlite3 "$USER_DB" "SELECT value FROM schema_meta WHERE key='user_store_schema_version';")"
echo "    user_store_schema_version=$UV"
test "$UV" = "1"

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
  --outDir "$TMPDIR/js" \
  modules/food-catalog/nutrients.ts \
  modules/food-catalog/types.ts \
  modules/food-catalog/module.ts \
  modules/food-catalog/index.ts

node << NODE
const n = require("$TMPDIR/js/nutrients.js");
const m = require("$TMPDIR/js/module.js");
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
test -f "$TMPDIR/js/nutrients.js"
test -f "$TMPDIR/js/types.js"
test -f "$TMPDIR/js/module.js"
echo "    food-catalog emit OK"

echo
echo "SMOKE OK — FoodSeed fixture + UserData DDL + TS contract"
echo "Demo artifacts (ephemeral): $DB , $USER_DB"
