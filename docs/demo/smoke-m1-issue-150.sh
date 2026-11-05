#!/usr/bin/env bash
# M1-84 (#150): time-aware meal and entry-time defaults.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
SMOKE_DIR="$ROOT/software/.smoke-issue-150"
trap 'rm -rf "$SMOKE_DIR"' EXIT

echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused meal, date propagation and log regressions'
node --test modules/diary/food-detail/defaultMeal.test.mjs scripts/issue-141-date-propagation.test.mjs modules/diary/food-detail/food-detail.test.mjs
echo '==> full serialized suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"
echo '==> Chrome: production log sheet at 390x844'
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"
CHROME_BIN="$CHROME" node scripts/smoke-issue-150-web.mjs "$SMOKE_DIR"
mkdir -p "$ROOT/out"
cat > "$ROOT/out/issue-150-smoke-result.txt" <<RESULT
smoke-m1-issue-150 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)
PASS: npx tsc --noEmit
PASS: npm run lint (no errors)
PASS: focused nearest-slot boundaries, custom/untimed slots, explicit slots, dates, log tests
PASS: full package.json test suite with --test-concurrency=1
PASS: Headless Chrome, production FoodDetailSheet + React Native Web at 390x844, light/dark:
  fixed local clock 2026-11-05 15:55 -> Dinner, 15:55;
  yesterday/tomorrow -> Dinner, 18:30;
  explicit Breakfast -> 15:55 today, 08:00 yesterday;
  manual Lunch remains selected through rerender and submits 12:30;
  explicit Snacks today -> 15:55;
  real log handler submits matching slot/date/local timestamp for every case.
Browser harness isolates native theme/safe-area context and persistence boundary.
It exercises production state/effects/calculation/submission, not a full Expo Search or SQLite flow.
Rule: nearest timed slot within local day, ties later, no midnight wrap;
  built-in boundaries 10:15 (Lunch), 15:30 (Dinner); today uses now to the minute.
RESULT
cat "$ROOT/out/issue-150-smoke-result.txt"
