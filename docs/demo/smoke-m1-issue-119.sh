#!/usr/bin/env bash
# M1-61 smoke (#119): Gentle companion illustration tokens + data-zone fence rule.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${ISSUE_119_SMOKE_PORT:-18119}"
BASE_URL="http://127.0.0.1:$PORT"
TMP_DIR="$(mktemp -d)"
SERVER_PID=""
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
cd "$ROOT/software"

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  if [[ -f "$TMP_DIR/chrome.log" ]]; then tail -40 "$TMP_DIR/chrome.log" >&2; fi
  exit 1
}
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

echo "==> light/dark gallery screenshots"
test -n "$CHROME" || fail "Chrome is required for screenshot verification"
mkdir -p "$TMP_DIR/gallery" "$TMP_DIR/screenshots"
./node_modules/.bin/esbuild scripts/issue-80-gallery-smoke.mjs \
  --bundle --platform=browser --format=esm --jsx=automatic \
  --alias:react-native=react-native-web \
  --alias:expo-navigation-bar=./scripts/issue-80-native-chrome-stub.mjs \
  --alias:expo-system-ui=./scripts/issue-80-native-chrome-stub.mjs \
  --define:process.env.NODE_ENV='"production"' \
  --outfile="$TMP_DIR/gallery/gallery.browser.js"
cp scripts/issue-80-gallery-smoke.html "$TMP_DIR/gallery/index.html"
python3 -m http.server "$PORT" --directory "$TMP_DIR" >"$TMP_DIR/http.log" 2>&1 &
SERVER_PID="$!"
for _attempt in {1..40}; do
  curl --fail --silent "$BASE_URL/gallery/index.html" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --fail --silent "$BASE_URL/gallery/index.html" >/dev/null || fail "screenshot server not ready"
for scheme in light dark; do
  timeout 30s "$CHROME" \
    --headless=old \
    --no-sandbox \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size=430,1200 \
    --ozone-override-screen-size=430,1200 \
    --screenshot="$TMP_DIR/screenshots/gallery-$scheme.png" \
    "$BASE_URL/gallery/index.html?theme=$scheme" >>"$TMP_DIR/chrome.log" 2>&1 \
    || fail "Chrome failed to capture $scheme gallery"
  test -s "$TMP_DIR/screenshots/gallery-$scheme.png" || fail "missing $scheme gallery screenshot"
done
node scripts/issue-119-gallery-screenshot.mjs \
  "$TMP_DIR/screenshots/gallery-light.png" "$TMP_DIR/screenshots/gallery-dark.png"
ok "light/dark gallery screenshots"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-119 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "screenshots: light/dark gallery brand button and illustration swatches rendered with expected colors and without clipping"
} > "$ROOT/out/issue-119-smoke-result.txt"
ok "wrote out/issue-119-smoke-result.txt"
