#!/usr/bin/env bash
# M1-63 smoke (#120): Figtree UI + Nunito display fonts, tabular numbers, no MacroFactor font.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

if find . -path ./node_modules -prune -o -iname '*macrosans*' -print | grep -q .; then
  fail "MacroFactor font file present"
fi
ok "no MacroFactor font file"

echo "==> typecheck"; npx tsc --noEmit; ok typecheck
echo "==> lint"; npm run -s lint; ok lint
echo "==> focused tests"; node --test scripts/issue-120-fonts.test.mjs design-system/tokens/tokens.test.mjs; ok "font tests"
echo "==> full test suite"; npm test --silent >/dev/null; ok "full test suite"

echo "==> web export bundles exactly the six product faces"
OUT=".smoke-web-120"; rm -rf "$OUT"
trap 'rm -rf "$ROOT/software/$OUT"' EXIT
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
faces=$(find "$OUT" -name '*.ttf' | grep -Eo '(Figtree|Nunito)_[0-9A-Za-z_]+' | sed 's/\..*//' | sort -u | tr '\n' ' ')
echo "faces: $faces"
[ "$faces" = "Figtree_400Regular Figtree_500Medium Figtree_600SemiBold Figtree_700Bold Nunito_700Bold Nunito_800ExtraBold " ] \
  || fail "unexpected bundled faces: $faces"
if find "$OUT" -iname '*macrosans*' | grep -q .; then fail "MacroSans in web bundle"; fi
ok "web bundle faces"

mkdir -p "$ROOT/out"
{ echo "smoke-m1-issue-120 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "faces: $faces"; } > "$ROOT/out/issue-120-smoke-result.txt"
ok "wrote out/issue-120-smoke-result.txt"
