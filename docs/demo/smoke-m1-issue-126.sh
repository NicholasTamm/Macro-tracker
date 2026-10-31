#!/usr/bin/env bash
# M1-68 smoke (#126): onboarding mascot on first/last steps + brand CTA.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test scripts/issue-126-onboarding-mascot.test.mjs scripts/qa-m1-21.test.mjs >/dev/null; ok "onboarding mascot + contrast tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

echo "==> web export bundles wave + cheer"
OUT=".smoke-web-126"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
for f in wave cheer; do
  find "$OUT" -path '*mascot*' -name "placeholder-$f*.svg" | grep -q . || fail "$f art missing"
done
ok "web bundle"

mkdir -p "$ROOT/out"
echo "smoke-m1-issue-126 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/out/issue-126-smoke-result.txt"
ok "wrote out/issue-126-smoke-result.txt"
