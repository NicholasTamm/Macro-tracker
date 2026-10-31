#!/usr/bin/env bash
# M1-65 smoke (#123): mascot empty states on Today (emptyPlate + Log food CTA) and Food Entry browse (think).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test scripts/issue-123-empty-states.test.mjs scripts/issue-122-mascot.test.mjs; ok "empty-state tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

echo "==> web export: CTA target route and empty-state art are bundled"
OUT=".smoke-web-123"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
find "$OUT" -path '*mascot*' -name 'placeholder-empty-plate*.svg' | grep -q . || fail "emptyPlate art missing"
find "$OUT" -path '*mascot*' -name 'placeholder-think*.svg' | grep -q . || fail "think art missing"
grep -rlq "Nothing on your plate yet" "$OUT" || fail "Today empty copy not in bundle"
grep -rlq "/food-entry" "$OUT" || fail "food-entry route not in bundle"
ok "web bundle"

mkdir -p "$ROOT/out"
echo "smoke-m1-issue-123 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/out/issue-123-smoke-result.txt"
ok "wrote out/issue-123-smoke-result.txt"
