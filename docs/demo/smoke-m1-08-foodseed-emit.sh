#!/usr/bin/env bash
# M1-08 smoke: emit packaged FoodSeed.sqlite v1 — FTS5, validations, zstd/gzip + signed manifest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

SEED="modules/food-catalog/scripts/build-seed"
test -f "$SEED/build-seed.mjs" || fail "missing build-seed.mjs"
test -f "$SEED/lib/emit-sqlite.mjs" || fail "missing emit-sqlite.mjs"
test -f "$SEED/lib/package-seed.mjs" || fail "missing package-seed.mjs"
test -f "$SEED/lib/validate-seed.mjs" || fail "missing validate-seed.mjs"
test -f "$SEED/lib/sign.mjs" || fail "missing sign.mjs"
test -f "$SEED/golden-queries.json" || fail "missing golden-queries.json"
test -f "$SEED/keys/food-seed-2026-01.pub" || fail "missing public signing key"
test -f "$SEED/keys/food-seed-2026-01.dev.pkcs8" || fail "missing dev private key"
test -f modules/food-catalog/schema/food-seed-v1.sql || fail "missing food-seed-v1.sql"
command -v sqlite3 >/dev/null || fail "sqlite3 CLI required (FTS5)"

if [[ ! -d node_modules ]]; then npm ci; fi

OUT="$SEED/out/smoke-m1-08"
rm -rf "$OUT"

echo "==> unit tests (emit packaging + build-seed + selection)"
node --test "$SEED/emit-package.test.mjs" "$SEED/build-seed.test.mjs" "$SEED/selection.test.mjs"
ok "emit-package + build-seed + selection unit tests"

echo "==> build-seed.mjs (fixture + selection + M1-08 package)"
node "$SEED/build-seed.mjs" --out "$OUT" --seed-version "smoke.m1-08.1"
test -f "$OUT/FoodSeed.sqlite" || fail "FoodSeed.sqlite not written"
test -f "$OUT/seed-manifest.json" || fail "seed-manifest.json not written"
test -f "$OUT/build-manifest.json" || fail "build-manifest.json not written"

COMPRESSED=""
if [[ -f "$OUT/FoodSeed.sqlite.zst" ]]; then
  COMPRESSED="$OUT/FoodSeed.sqlite.zst"
elif [[ -f "$OUT/FoodSeed.sqlite.gz" ]]; then
  COMPRESSED="$OUT/FoodSeed.sqlite.gz"
else
  fail "compressed artifact missing (.zst or .gz)"
fi

FOODS="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM food;')"
FTS="$(sqlite3 "$OUT/FoodSeed.sqlite" 'SELECT COUNT(*) FROM food_fts;')"
INTEGRITY="$(sqlite3 "$OUT/FoodSeed.sqlite" 'PRAGMA integrity_check;')"
FK="$(sqlite3 "$OUT/FoodSeed.sqlite" 'PRAGMA foreign_key_check;')"
FAILS="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM build_validation WHERE status='fail';")"
GOLDEN_PASS="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT COUNT(*) FROM build_validation WHERE check_name LIKE 'golden:%' AND status='pass';")"
DEFAULT_OK="$(sqlite3 "$OUT/FoodSeed.sqlite" "SELECT status FROM build_validation WHERE check_name='default_serving_ownership';")"

MAN_SHA="$(node -e "const m=JSON.parse(require('fs').readFileSync('$OUT/seed-manifest.json','utf8')); if(!/^[0-9a-f]{64}$/.test(m.artifact.sha256)) process.exit(1); if(!m.artifact.signature) process.exit(2); if(m.artifact.signingKeyID!=='food-seed-2026-01') process.exit(3); console.log(m.artifact.sha256)")"
MAN_COMP="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/seed-manifest.json','utf8')).artifact.compression)")"
MAN_FOODS="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/seed-manifest.json','utf8')).content.foodCount)")"
FILE_SHA="$(node -e "const {createHash}=require('crypto'); const fs=require('fs'); const h=createHash('sha256'); h.update(fs.readFileSync('$COMPRESSED')); console.log(h.digest('hex'))")"

# Verify signature with public key
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { loadPublicKey, verifySha256HexSignature } from './$SEED/lib/sign.mjs';
const m = JSON.parse(await readFile('$OUT/seed-manifest.json', 'utf8'));
const { key } = await loadPublicKey();
if (!verifySha256HexSignature(m.artifact.sha256, m.artifact.signature, key)) {
  console.error('signature verify failed');
  process.exit(1);
}
console.log('signature_ok');
"

echo "    foods=$FOODS fts=$FTS integrity=$INTEGRITY fk=${FK:-none} fails=$FAILS golden_pass=$GOLDEN_PASS default=$DEFAULT_OK"
echo "    compression=$MAN_COMP manifest_sha=${MAN_SHA:0:12}… file_sha=${FILE_SHA:0:12}… compressed=$(basename "$COMPRESSED")"

test "$INTEGRITY" = "ok" || fail "integrity_check"
test -z "$FK" || fail "foreign_key_check nonempty"
test "$FOODS" = "$FTS" || fail "fts parity"
test "$FAILS" = "0" || fail "build_validation failures"
test "$GOLDEN_PASS" -ge 6 || fail "golden queries"
test "$DEFAULT_OK" = "pass" || fail "default_serving_ownership"
test "$MAN_SHA" = "$FILE_SHA" || fail "manifest sha256 != compressed file"
test "$MAN_FOODS" = "$FOODS" || fail "manifest foodCount"
test "$FOODS" = "14" || fail "expected 14 selected foods"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-08-foodseed-emit PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "mode=fixture foods=$FOODS compression=$MAN_COMP"
  echo "seed_manifest=$OUT/seed-manifest.json"
  echo "compressed=$COMPRESSED"
  echo "sha256=$MAN_SHA"
  echo "one-command: cd software && node modules/food-catalog/scripts/build-seed/build-seed.mjs"
} | tee "$ROOT/out/issue-42-smoke-result.txt"

ok "smoke-m1-08-foodseed-emit"
