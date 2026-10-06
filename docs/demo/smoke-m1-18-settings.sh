#!/usr/bin/env bash
# M1-18 smoke: settings units/theme, profile, attribution, licenses, privacy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

SETTINGS="modules/app-core/settings"
for file in themePreference.ts unitDisplay.ts citation.ts licenses.ts settings.test.mjs; do
  test -f "$SETTINGS/$file" || fail "missing $SETTINGS/$file"
done
for route in profile units about licenses privacy; do
  test -f "app/settings/$route.tsx" || fail "missing settings route: $route"
done
test -f app/settings/_layout.tsx || fail "missing settings stack layout"
test -f modules/food-catalog/schema/user-store-v3-settings.sql || fail "missing settings migration"

rg -n "settings/(profile|units|about|licenses|privacy)" 'app/(tabs)/settings.tsx' >/dev/null \
  || fail "Settings tab missing routes"
rg -n "U\.S\. Department of Agriculture, Agricultural Research Service|FoodData Central" "$SETTINGS/citation.ts" >/dev/null \
  || fail "USDA citation missing"
rg -n "forcedScheme|themePreference" app/_layout.tsx components/UserDataProvider.tsx >/dev/null \
  || fail "persisted theme wiring missing"
rg -n "weightKg|heightCm|energyKcal" "$SETTINGS/settings.test.mjs" >/dev/null \
  || fail "canonical unit invariance test missing"
ok "settings files and routes present"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> focused settings tests"
node --test "$SETTINGS/settings.test.mjs"
ok "settings tests"

echo "==> full serialized test suite"
TEST_COMMAND="$(node -p "require('./package.json').scripts.test")"
TEST_FILES="${TEST_COMMAND#node --test }"
# shellcheck disable=SC2086
node --test --test-concurrency=1 $TEST_FILES
ok "full test suite"

mkdir -p "$ROOT/out"
echo "smoke-m1-18-settings PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-63-smoke-result.txt"
