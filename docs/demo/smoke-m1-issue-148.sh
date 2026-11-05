#!/usr/bin/env bash
# M1-82 (#148): no-results mascot and icon-free EmptyState fallback.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
SMOKE_DIR="$(mktemp -d "$ROOT/software/.smoke-148.XXXXXX")"
trap 'rm -rf "$SMOKE_DIR"' EXIT
rg -q 'scripts/issue-148-empty-results.test.mjs' package.json
echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused no-results and shared empty-state regression tests'
node --test scripts/issue-148-empty-results.test.mjs scripts/issue-122-mascot.test.mjs scripts/issue-123-empty-states.test.mjs
echo '==> full serialized suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"
echo '==> Chrome: real EmptyState and Mascot through RN Web, 390x844, light/dark'
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"
CHROME_BIN="$CHROME" node scripts/smoke-issue-148-web.mjs "$SMOKE_DIR" | tee "$SMOKE_DIR/browser-result.txt"
mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-148 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git rev-parse HEAD)"
  echo "software-tree $(git rev-parse HEAD:software)"
  echo 'PASS: npx tsc --noEmit'
  echo 'PASS: npm run lint (no errors; existing warnings only)'
  echo 'PASS: focused no-results, fallback, custom illustration, CTA, and existing empty-state regressions'
  echo 'PASS: full package.json test suite with --test-concurrency=1'
  cat "$SMOKE_DIR/browser-result.txt"
  echo 'Browser: production no-results JSX, EmptyState and Mascot + RN Web at 390x844 in light/dark; actual placeholder SVG loads at 96px, copy preserved, no clipboard, text-only fallback.'
  echo 'Harness isolates theme context and uses real design tokens, expo-image and UI components. Full Expo search/catalog flow was not exercised.'
} | tee "$ROOT/out/issue-148-smoke-result.txt"
