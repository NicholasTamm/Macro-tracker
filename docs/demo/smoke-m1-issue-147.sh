#!/usr/bin/env bash
# M1-81 (#147): user-facing diary edit copy; immutable scaling is unchanged.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
SMOKE_DIR="$(mktemp -d "$ROOT/software/.smoke-147.XXXXXX")"
trap 'rm -rf "$SMOKE_DIR"' EXIT
rg -q 'scripts/issue-147-edit-copy.test.mjs' package.json
echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused copy and immutable diary-edit regression tests'
node --test scripts/issue-147-edit-copy.test.mjs modules/diary/entry-edit/diary-edit.test.mjs
echo '==> full serialized suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"
echo '==> Chrome: real edit sheet through RN Web, 390x844, light/dark'
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"
CHROME_BIN="$CHROME" node scripts/smoke-issue-147-web.mjs "$SMOKE_DIR" | tee "$SMOKE_DIR/browser-result.txt"
mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-147 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git rev-parse HEAD)"
  echo "software-tree $(git rev-parse HEAD:software)"
  echo 'PASS: npx tsc --noEmit'
  echo 'PASS: npm run lint (no errors; existing warnings only)'
  echo 'PASS: focused subtitle/error copy and existing immutable diary-edit regression tests'
  echo 'PASS: full package.json test suite with --test-concurrency=1'
  cat "$SMOKE_DIR/browser-result.txt"
  echo 'Browser: production DiaryEntryEditSheet + RN Web at 390x844 in light/dark; gram/serving subtitle and failed-calculation copy contain no developer wording.'
  echo 'Harness isolates native theme/safe-area context and uses real design tokens and UI components. Full Expo diary flow was not exercised.'
} | tee "$ROOT/out/issue-147-smoke-result.txt"
