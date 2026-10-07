#!/usr/bin/env bash
# M1-21 smoke: accessibility / localization / privacy QA gates.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

dirty_paths="$(git -C "$ROOT" status --porcelain -- software docs/demo docs/m1-21-a11y-l10n-privacy-qa.md)"
[[ -z "$dirty_paths" ]] || fail "refusing to smoke a dirty QA tree: $dirty_paths"
head_sha="$(git -C "$ROOT" rev-parse HEAD)"
software_tree="$(git -C "$ROOT" rev-parse HEAD:software)"

test -f "$ROOT/docs/m1-21-a11y-l10n-privacy-qa.md" || fail "missing QA report"
test -f scripts/qa-m1-21.test.mjs || fail "missing QA gate tests"
test -f design-system/theme/useReduceMotion.ts || fail "missing useReduceMotion"
rg -n "Open critical findings: \*\*0\*\*" "$ROOT/docs/m1-21-a11y-l10n-privacy-qa.md" >/dev/null \
  || fail "report must record zero open critical findings"
ok "report + gates present"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> M1-21 QA gates (contrast, permissions, network, RTL, Reduce Motion, labels)"
node --test scripts/qa-m1-21.test.mjs
ok "QA gates"

echo "==> npm test (full suite, concurrency 1)"
rm -rf modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock 2>/dev/null || true
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "npm test"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-21-qa PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD $head_sha"
  echo "software-tree $software_tree"
} | tee "$ROOT/out/issue-66-smoke-result.txt"
