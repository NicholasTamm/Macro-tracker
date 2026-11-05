#!/usr/bin/env bash
# M1-85 (#151): require valid user-entered onboarding biometrics.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
SMOKE_DIR="$ROOT/software/.smoke-issue-151"
trap 'rm -rf "$SMOKE_DIR"' EXIT

echo '==> typecheck'
npx tsc --noEmit
echo '==> lint'
npm run lint
echo '==> focused biometrics and onboarding regressions'
node --test scripts/issue-151-biometrics.test.mjs modules/app-core/user-data/onboarding.test.mjs modules/app-core/settings/settings.test.mjs
echo '==> full serialized suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
test "${#TEST_FILES[@]}" -gt 0
node --test --test-concurrency=1 "${TEST_FILES[@]}"
echo '==> Chrome: production biometrics at 390x844'
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"
CHROME_BIN="$CHROME" node scripts/smoke-issue-151-web.mjs "$SMOKE_DIR"
mkdir -p "$ROOT/out"
cat > "$ROOT/out/issue-151-smoke-result.txt" <<RESULT
smoke-m1-issue-151 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)
PASS: npx tsc --noEmit
PASS: npm run lint (no errors)
PASS: focused production biometrics validation, onboarding and settings tests
PASS: full package.json test suite with --test-concurrency=1
PASS: Headless Chrome, production BiometricsScreen, OnboardingShell and PrimaryButton
  through React Native Web at 390x844, light/dark, cm/kg and in/lb:
  fresh profile fields blank; Continue disabled with control fill/muted label at full opacity;
  partial input, underage birth year, zero/negative/cleared measurements block saving;
  valid input enables brand CTA, saves canonical cm/kg, refreshes and routes to Goal.
PASS: regression tests preserve saved profile values and reject nonfinite/nonnumeric input,
  whitespace, fractional/out-of-range birth years, and every cleared required field.
Root cause: hard-coded fallback birth year/height/weight silently satisfied existing validation.
The onboarding model has no skip path; secondary action remains Back.
Browser harness isolates persistence, router, native theme and safe-area context.
It exercises production input/state/validation/submission and styles, not a full Expo/SQLite flow.
RESULT
cat "$ROOT/out/issue-151-smoke-result.txt"
