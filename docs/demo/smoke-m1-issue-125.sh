#!/usr/bin/env bash
# M1-67 smoke (#125): goal-hit card + once-per-day haptic.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test modules/diary/goalHit.test.mjs; ok "goal-hit tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"
echo "==> sql.js store: log to target, reload, flag claimed once"
line=$(node scripts/smoke-issue-125.mjs) || fail "store smoke failed"; echo "$line"

echo "==> web export bundles the card"
OUT=".smoke-web-125"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
grep -rlq "You hit today" "$OUT" || fail "card copy missing from bundle"
find "$OUT" -path '*mascot*' -name 'placeholder-cheer*.svg' | grep -q . || fail "cheer art missing"
ok "web bundle"

mkdir -p "$ROOT/out"
{ echo "smoke-m1-issue-125 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "$line"; } > "$ROOT/out/issue-125-smoke-result.txt"
ok "wrote out/issue-125-smoke-result.txt"
