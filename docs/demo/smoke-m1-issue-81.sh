#!/usr/bin/env bash
# M1-32 smoke: compact typography roles + MacroSans offline load.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

TEST="scripts/issue-81-typography.test.mjs"
test -f "$TEST" || fail "missing issue #81 regression test"
test -f assets/fonts/MacroSans-VF.ttf || fail "MacroSans font missing"
test -f design-system/fonts/loadProductFonts.ts || fail "font loader missing"
rg -n "pageTitle|foodName|metadata|chartAxis|FONT_DISPLAY" design-system/tokens/typography.ts >/dev/null \
  || fail "expanded typography roles missing"
rg -n "useProductFonts" app/_layout.tsx >/dev/null || fail "root layout does not load fonts"
node -e "const p=require('./package.json'); if (!p.scripts.test.includes('$TEST')) process.exit(1)" \
  || fail "focused test missing from package.json test script"
ok "issue #81 implementation and regression coverage present"

echo "==> typecheck"
./node_modules/.bin/tsc --noEmit
ok "typecheck"

echo "==> focused issue #81 + token tests"
node --test "$TEST" design-system/tokens/tokens.test.mjs
ok "typography gates"

echo "==> full serialized test suite"
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "full test suite"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-81 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "coverage: MacroSans bundled + expo-font loader, role scale (display/pageTitle/metric/section/control/foodName/body/caption/metadata/chartAxis), FoodRow roles, non-blocking root load"
  echo "note: light/dark screenshot parity vs gallery type specimens deferred to device/gallery pass"
} | tee "$ROOT/out/issue-81-smoke-result.txt"
