#!/usr/bin/env bash
# M1-31 smoke: semantic color tokens, theme-stable data domains, native chrome sync.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

TEST="scripts/issue-80-color-tokens.test.mjs"
test -f "$TEST" || fail "missing issue #80 regression test"
test -f design-system/tokens/colors.ts || fail "missing colors.ts"
rg -n "infoFill|overage|tile:" design-system/tokens/colors.ts >/dev/null \
  || fail "expanded semantic tokens missing"
rg -n "colors\.infoFill|colors\.dangerFill|colors\.warningInk" design-system/components/ErrorBanner.tsx >/dev/null \
  || fail "ErrorBanner still uses raw fills"
rg -n "setBackgroundColorAsync|StatusBar" design-system/theme/ThemeProvider.tsx >/dev/null \
  || fail "ThemeProvider native chrome sync missing"
node -e "const p=require('./package.json'); if (!p.scripts.test.includes('$TEST')) process.exit(1)" \
  || fail "focused test missing from package.json test script"
ok "issue #80 implementation and regression coverage present"

echo "==> typecheck"
./node_modules/.bin/tsc --noEmit
ok "typecheck"

echo "==> focused issue #80 + token + a11y contrast tests"
node --test "$TEST" design-system/tokens/tokens.test.mjs scripts/qa-m1-21.test.mjs
ok "color token + contrast gates"

echo "==> full serialized test suite"
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "full test suite"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-80 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "coverage: semantic surfaces/state/overage tokens, theme-stable data domains, ErrorBanner token fills, StatusBar/SystemUI chrome sync, WCAG contrast gate"
  echo "note: paired light/dark screenshot diffs vs design-system/index.html deferred to device/gallery pass"
} | tee "$ROOT/out/issue-80-smoke-result.txt"
