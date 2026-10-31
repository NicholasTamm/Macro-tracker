#!/usr/bin/env bash
# M1-73 (#139): computed macro tracks, over-target text, and accessible percentages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
SMOKE_DIR="$ROOT/software/.smoke-issue-139"
trap 'rm -rf "$SMOKE_DIR"' EXIT

echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused regression tests'
node --test scripts/issue-139-macro-progress.test.mjs
echo '==> full serialized suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"
echo '==> Chrome: real RN Web component, 390px, light/dark'
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"
CHROME_BIN="$CHROME" node scripts/smoke-issue-139-web.mjs "$SMOKE_DIR"
mkdir -p "$ROOT/out"
cat > "$ROOT/out/issue-139-smoke-result.txt" <<RESULT
smoke-m1-issue-139 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)
PASS: npx tsc --noEmit
PASS: npm run lint (no errors; existing warnings may remain)
PASS: focused macro progress regression tests
PASS: full package.json test suite with --test-concurrency=1
PASS: Headless Chrome, real MacroSummary + React Native Web at 390px in light/dark:
  0%, 50%, 100%, 159% rendered fill widths; accessible percentages;
  visible Over target only above 100%; aligned tracks; no cell/viewport overflow.
Browser harness isolates the native theme provider and uses real palette/typography tokens.
This verifies the component in a browser; a full Expo diary flow was not exercised.
RESULT
cat "$ROOT/out/issue-139-smoke-result.txt"
