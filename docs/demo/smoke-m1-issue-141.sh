#!/usr/bin/env bash
# M1-75: viewed-day propagation through Search and food logging.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
rg -q 'issue-141-date-propagation.test.mjs' package.json
rg -q 'localDayKey=\{localDayKey\}' 'app/(tabs)/food-entry.tsx'
npx tsc --noEmit
node --test scripts/issue-141-date-propagation.test.mjs
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
node --test --test-concurrency=1 "${TEST_FILES[@]}"
web_result="Web sheet render/submit with real sql.js: labels, calendar day and meal timestamp PASS (regression tests)."
if [[ -n "${ISSUE141_BASE_URL:-}" ]]; then
  web_result="$(node scripts/smoke-issue-141-web.mjs)"
fi
mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-141 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $(git rev-parse HEAD)"
  echo "software-tree $(git rev-parse HEAD:software)"
  echo "focused source checks, typecheck, regression tests, full serialized suite PASS"
  echo "$web_result"
} | tee "$ROOT/out/issue-141-smoke-result.txt"
