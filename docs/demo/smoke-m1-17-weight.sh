#!/usr/bin/env bash
# M1-17 smoke: Weight sample CRUD + 30-day accessible chart.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

W="modules/app-core/weight"
UD="modules/app-core/user-data"

test -f "$W/weightSeries.ts" || fail "missing weightSeries"
test -f "$W/WeightChart.tsx" || fail "missing WeightChart"
test -f "$W/weight.test.mjs" || fail "missing weight tests"
test -f "app/(tabs)/analytics.tsx" || fail "missing Analytics/Weight screen"

rg -n "updateWeightSample|tombstoneWeightSample|getWeightSample" "$UD/index.ts" >/dev/null \
  || fail "user-data index missing weight edit/delete exports"
rg -n "createWeightSample|updateWeightSample|tombstoneWeightSample" "app/(tabs)/analytics.tsx" >/dev/null \
  || fail "Analytics screen missing weight CRUD wiring"
rg -n 'accessibilityRole="image"' "$W/WeightChart.tsx" >/dev/null \
  || fail "WeightChart missing accessible image role"
if rg -n "victory|react-native-svg|chart-kit|recharts" package.json >/dev/null; then
  fail "heavy chart dependency added"
fi
ok "weight wiring (no chart deps)"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> weight tests"
node --test "$W/weight.test.mjs"
ok "weight tests"

echo "==> npm test (full suite, concurrency 1)"
rm -rf modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock 2>/dev/null || true
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-17-weight PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-64-smoke-result.txt"
