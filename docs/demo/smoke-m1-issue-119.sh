#!/usr/bin/env bash
# M1-61 smoke (#119): Gentle companion illustration tokens + data-zone fence rule.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

test -f "$ROOT/docs/design/gentle-companion.md" || fail "fence rule doc missing"
for k in illoProteinTint illoCarbsTint illoFatTint illoEnergyTint mascotTint mascot onBrand; do
  [ "$(rg -c "^  $k:" design-system/tokens/colors.ts)" -ge 1 ] || fail "token $k missing"
done
ok "illustration tokens declared"
rg -q "variant === 'brand'" design-system/components/PrimaryButton.tsx || fail "brand button variant missing"
rg -q 'variant="brand"' design-system/Gallery.tsx || fail "gallery brand specimen missing"
rg -q "illoProteinTint" design-system/Gallery.tsx || fail "gallery swatches missing"
ok "brand button + gallery specimens"
if rg -n "illo[A-Za-z]+Tint|mascotTint" components/MacroSummary* design-system/components/MacroSummary.tsx modules/app-core/weight 2>/dev/null; then
  fail "illustration tokens leaked into the data zone"
fi
ok "data zone free of illustration tokens"

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> token tests"; node --test design-system/tokens/tokens.test.mjs; ok "token tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

mkdir -p "$ROOT/out"
echo "smoke-m1-issue-119 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/out/issue-119-smoke-result.txt"
ok "wrote out/issue-119-smoke-result.txt"
