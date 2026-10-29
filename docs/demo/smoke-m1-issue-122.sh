#!/usr/bin/env bash
# M1-64 smoke (#122): placeholder mascot (six poses) + EmptyState illustration slot.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

for f in wave think cheer sleep scale empty-plate; do
  [ -f "assets/mascot/placeholder-$f.svg" ] || fail "missing placeholder-$f.svg"
done
ok "six placeholder poses present"

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test scripts/issue-122-mascot.test.mjs; ok "mascot tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

echo "==> web export bundles every pose"
OUT=".smoke-web-122"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
for f in wave think cheer sleep scale empty-plate; do
  find "$OUT" -path '*mascot*' -name "placeholder-$f*.svg" | grep -q . || fail "pose $f not in web bundle"
done
ok "web bundle has all six poses"

mkdir -p "$ROOT/out"
echo "smoke-m1-issue-122 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/out/issue-122-smoke-result.txt"
ok "wrote out/issue-122-smoke-result.txt"
