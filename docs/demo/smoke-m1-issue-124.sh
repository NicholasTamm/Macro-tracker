#!/usr/bin/env bash
# M1-66 smoke (#124): scale mascot on Analytics when there are no weigh-ins.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test scripts/issue-124-weight-empty.test.mjs; ok "weight empty-state tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

echo "==> web export bundles the scale pose"
OUT=".smoke-web-124"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
find "$OUT" -path '*mascot*' -name 'placeholder-scale*.svg' | grep -q . || fail "scale art missing"
grep -rlq "No weights yet" "$OUT" || fail "empty copy missing"
ok "web bundle"

mkdir -p "$ROOT/out"
echo "smoke-m1-issue-124 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/out/issue-124-smoke-result.txt"
ok "wrote out/issue-124-smoke-result.txt"
