#!/usr/bin/env bash
# M1-76 (#142): starter weight state and the two-weigh-in chart threshold.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

echo "==> typecheck"
npx tsc --noEmit
echo "==> lint"
npm run -s lint
echo "==> focused starter-state, onboarding and chart tests"
node --test --test-concurrency=1 scripts/issue-142-weight-trend.test.mjs scripts/issue-124-weight-empty.test.mjs modules/app-core/weight/weight.test.mjs
echo "==> full test suite (serial)"
# Put Node's option before the explicit test file list in package.json.
TEST_COMMAND="$(node -p 'require("./package.json").scripts.test.replace("node --test ", "node --test --test-concurrency=1 ")')"
bash -c "$TEST_COMMAND"
echo "==> Expo web export"
WEB_OUT=".smoke-web-142"
trap 'rm -rf "$ROOT/software/$WEB_OUT"' EXIT
npx expo export --platform web --output-dir "$WEB_OUT"
rg -q --glob '*.js' 'Starting weight' "$WEB_OUT"
rg -q --glob '*.js' 'No weights yet' "$WEB_OUT"
find "$WEB_OUT" -name 'placeholder-scale*.svg' -print -quit | rg -q .

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-142 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git rev-parse HEAD)"
  echo "PASS: TypeScript, lint, focused tests, full package.json suite with --test-concurrency=1"
  echo "PASS: real sql.js onboarding seeds 80 kg; one weight hides chart; second shows chart; deletion restores starter then empty"
  echo "PASS: range excludes old/future/deleted entries; kg/lb starter copy; Entries remain available; no chart mascot"
  echo "PASS: Expo web export bundles starter copy, No weights yet and scale asset"
  echo "Browser check: at 390x844, complete onboarding with 80 kg, open Analytics; verify starter/scale with no chart, add second weigh-in for chart, delete back to zero for No weights yet."
} > "$ROOT/out/issue-142-smoke-result.txt"
echo "OK: out/issue-142-smoke-result.txt"
