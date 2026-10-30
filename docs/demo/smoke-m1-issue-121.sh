#!/usr/bin/env bash
# M1-62 smoke (#121): Fluent Emoji Flat food icons replace system emoji in food rows.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

n=$(find assets/food-icons -name '*.svg' | wc -l | tr -d ' ')
[ "$n" -ge 30 ] || fail "expected >=30 bundled icons, found $n"
[ -f assets/food-icons/LICENSE-fluent-emoji.txt ] || fail "Fluent MIT licence missing"
ok "$n Fluent icons + MIT licence bundled"

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test modules/food-catalog/foodIcon.test.mjs; ok "food icon tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

echo "==> web export bundles the SVG assets"
OUT=".smoke-web-121"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
svgs=$(find "$OUT" -name '*.svg' -path '*food-icons*' | wc -l | tr -d ' ')
[ "$svgs" -ge 30 ] || fail "web bundle has $svgs food-icon SVGs"
for k in banana egg bowl_with_spoon poultry_leg; do
  find "$OUT" -path '*food-icons*' -name "$k*.svg" | grep -q . || fail "missing $k in web bundle"
done
ok "web bundle has $svgs food-icon SVGs"

mkdir -p "$ROOT/out"
{ echo "smoke-m1-issue-121 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "icons: $n bundled, $svgs in web export"; } > "$ROOT/out/issue-121-smoke-result.txt"
ok "wrote out/issue-121-smoke-result.txt"
