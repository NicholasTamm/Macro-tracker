#!/usr/bin/env bash
# M1-20 smoke: signed seed manifest verification and atomic activation rollback.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

SEED_UPDATE="modules/food-catalog/seed-update"
for file in \
  types.ts manifest.ts runSeedUpdate.ts InMemorySeedStore.ts keys.ts \
  expoSeedStore.ts index.ts seed-update.test.mjs README.md; do
  test -f "$SEED_UPDATE/$file" || fail "missing $SEED_UPDATE/$file"
done

rg -n "SEED_UPDATE_ENABLED = false" "$SEED_UPDATE/runSeedUpdate.ts" >/dev/null \
  || fail "seed update feature flag must default false"
rg -n "export \* from './seed-update'" modules/food-catalog/index.ts >/dev/null \
  || fail "food-catalog index missing seed-update export"
rg -n "seed-update/seed-update\.test\.mjs" package.json >/dev/null \
  || fail "package test script missing seed-update tests"
ok "files, public export, and disabled-by-default flag"

if [[ ! -d node_modules/esbuild ]]; then npm ci; fi

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> seed update focused tests"
node --test "$SEED_UPDATE/seed-update.test.mjs"
ok "seed update tests"

echo "==> full serialized test suite"
mapfile -t TEST_FILES < <(node -e \
  "const s=require('./package.json').scripts.test.split(' '); console.log(s.filter(x=>x.endsWith('.test.mjs')).join('\\n'))")
test "${#TEST_FILES[@]}" -gt 0 || fail "could not read package test files"
node --test --test-concurrency=1 "${TEST_FILES[@]}"
ok "full test suite"

mkdir -p "$ROOT/out"
echo "smoke-m1-20-seed-update PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | tee "$ROOT/out/issue-65-smoke-result.txt"
