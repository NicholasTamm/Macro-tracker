#!/usr/bin/env bash
# M1-19 smoke: Complete CSV + JSON export via platform share sheet.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

EX="modules/app-core/export"

test -f "$EX/buildExportPayload.ts" || fail "missing buildExportPayload"
test -f "$EX/toCsv.ts" || fail "missing toCsv"
test -f "$EX/toJson.ts" || fail "missing toJson"
test -f "$EX/shareExport.ts" || fail "missing shareExport"
test -f "$EX/buildUserDataExportFiles.ts" || fail "missing buildUserDataExportFiles"
test -f "$EX/export.test.mjs" || fail "missing export tests"
test -f "$EX/index.ts" || fail "missing export index"
test -f "$EX/README.md" || fail "missing export README"
test -f modules/app-core/user-data/weightSampleRepo.ts || fail "missing weightSampleRepo"
test -f app/\(tabs\)/settings.tsx || fail "missing Settings screen"

rg -n "buildUserDataExportFiles|shareExportViaPlatform|Export data" app/\(tabs\)/settings.tsx >/dev/null \
  || fail "Settings missing export wiring"
rg -n "buildUserDataExportFiles|EXPO_FILE_SHARE_PATH_DOC" modules/app-core/export/index.ts >/dev/null \
  || fail "export index missing public API"
rg -n "shareExportViaPlatform" modules/app-core/export/shareExport.ts >/dev/null \
  || fail "shareExport helper missing"
rg -n "export \* from './export'" modules/app-core/index.ts >/dev/null \
  || fail "app-core index missing export re-export"

# Must not dump shared catalog / remote cache (comments mentioning FoodSeed exclusion are OK)
if rg -n "FROM remote_food_cache|FROM food\b|FoodSeed\.sqlite" "$EX/buildExportPayload.ts" >/dev/null; then
  fail "export payload must not query FoodSeed/remote cache"
fi
ok "export stays user-owned (no catalog dump)"

rg -n "EXPO_FILE_SHARE_PATH_DOC|Share.share" "$EX/shareExport.ts" >/dev/null \
  || fail "share path / Expo docs missing"
ok "share sheet path present"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> export unit tests (round-trip fixture)"
node --test "$EX/export.test.mjs"
ok "export tests"

echo "==> npm test (full suite)"
# Clear transient fixture locks; serialize to avoid node-sqlite3-wasm lock flakes
rm -rf modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock 2>/dev/null || true
node --test --test-concurrency=1   scripts/secret-scan.test.mjs   design-system/tokens/tokens.test.mjs   design-system/components/__tests__/a11y-targets.test.mjs   modules/app-core/user-data/user-data.test.mjs   modules/app-core/user-data/onboarding.test.mjs   modules/app-core/export/export.test.mjs   modules/diary/diary.test.mjs   modules/diary/food-detail/food-detail.test.mjs   modules/diary/entry-edit/diary-edit.test.mjs   modules/diary/custom-food/custom-food.test.mjs   modules/food-catalog/scripts/build-seed/build-seed.test.mjs   modules/food-catalog/scripts/build-seed/selection.test.mjs   modules/food-catalog/scripts/build-seed/emit-package.test.mjs   modules/food-catalog/local-food-repo/local-food-repo.test.mjs   modules/food-catalog/search/search.test.mjs
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-19-export PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-59-smoke-result.txt"
