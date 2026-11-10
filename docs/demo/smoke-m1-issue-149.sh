#!/usr/bin/env bash
# M1-83 (#149): compact macro values fit Today at 390px without losing spoken precision.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
SMOKE_DIR="$ROOT/software/.smoke-issue-149"
trap 'rm -rf "$SMOKE_DIR"' EXIT

echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused formatted-string and progress regressions'
node --test scripts/issue-149-macro-summary.test.mjs scripts/issue-139-macro-progress.test.mjs
echo '==> full serialized suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"
echo '==> Chrome: real RN Web component at 390x844'
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"
CHROME_BIN="$CHROME" node scripts/smoke-issue-149-web.mjs "$SMOKE_DIR"
mkdir -p "$ROOT/out"
cat > "$ROOT/out/issue-149-smoke-result.txt" <<RESULT
smoke-m1-issue-149 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)
PASS: npx tsc --noEmit
PASS: npm run lint (no errors)
PASS: formatted-string and existing macro progress regressions
PASS: full package.json test suite with --test-concurrency=1
PASS: Headless Chrome, real MacroSummary + React Native Web at 390x844:
  Today 12px outer padding + real Card padding and cell spacing;
  light/dark, loaded Figtree and system fallback, kcal/kJ;
  2217/2300 kcal, 194.9/173.2g, 100.1/110.8g, 399.9/400.2g;
  upper bounds 9999/9999 kcal and 999.9/999.9g (including rounding to 1000);
  formatted text stays one line, fully visible without clipping or cell/viewport overflow;
  accessibility retains decimal consumed/target values and full unit names.
Browser harness isolates the native theme provider and uses real palette/typography tokens.
This verifies the component in a browser; a full Expo diary flow was not exercised.
RESULT
cat "$ROOT/out/issue-149-smoke-result.txt"
