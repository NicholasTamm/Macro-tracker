#!/usr/bin/env bash
# M1-25 smoke: settings navigation and choice-row web accessibility.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

dirty_paths="$(git -C "$ROOT" status --porcelain -- software docs/demo docs/m1-25-settings-choice-a11y-qa.md)"
[[ -z "$dirty_paths" ]] || fail "refusing to smoke a dirty M1-25 tree: $dirty_paths"
head_sha="$(git -C "$ROOT" rev-parse HEAD)"
software_tree="$(git -C "$ROOT" rev-parse HEAD:software)"

test -f components/HeaderBackButton.tsx || fail "missing custom header back control"
test -f scripts/qa-m1-25.test.mjs || fail "missing M1-25 regression gate"
test -f "$ROOT/docs/m1-25-settings-choice-a11y-qa.md" || fail "missing M1-25 QA report"
rg -n 'label="Back to Settings"|headerBackVisible: false' app/settings/_layout.tsx >/dev/null \
  || fail "Settings header accessibility contract missing"
rg -n 'accessibilityRole="radiogroup"|aria-checked=\{selected\}' app/onboarding/ChoiceRow.tsx >/dev/null \
  || fail "choice accessibility contract missing"
ok "focused source checks"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> focused M1-25 accessibility tests"
node --test scripts/qa-m1-25.test.mjs
ok "focused accessibility tests (including React Native Web DOM)"

echo "==> full serialized test suite"
rm -f modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock
TEST_COMMAND="$(node -p "require('./package.json').scripts.test")"
TEST_FILES="${TEST_COMMAND#node --test }"
# shellcheck disable=SC2086
node --test --test-concurrency=1 $TEST_FILES
ok "full test suite"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-74 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $head_sha"
  echo "software-tree $software_tree"
  echo "web verification: React Native Web DOM assertions PASS; interactive browser/device steps documented in docs/m1-25-settings-choice-a11y-qa.md"
} | tee "$ROOT/out/issue-74-smoke-result.txt"
