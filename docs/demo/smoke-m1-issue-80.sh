#!/usr/bin/env bash
# M1-31 smoke: semantic color tokens, theme-stable data domains, native chrome sync.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REFERENCE_DIR="${DESIGN_SYSTEM_REFERENCE_DIR:-/workspace/macrofactor-codex-research/design-system}"
PORT="${ISSUE_80_SMOKE_PORT:-18080}"
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

TEST="scripts/issue-80-color-tokens.test.mjs"
test -f "$TEST" || fail "missing issue #80 regression test"
test -f design-system/tokens/colors.ts || fail "missing colors.ts"
rg -n "infoFill|overage|tile:" design-system/tokens/colors.ts >/dev/null \
  || fail "expanded semantic tokens missing"
rg -n "colors\.infoFill|colors\.dangerFill|colors\.warningInk" design-system/components/ErrorBanner.tsx >/dev/null \
  || fail "ErrorBanner still uses raw fills"
rg -n "setBackgroundColorAsync|StatusBar" design-system/theme/ThemeProvider.tsx >/dev/null \
  || fail "ThemeProvider native chrome sync missing"
rg -n "setButtonStyleAsync" design-system/theme/ThemeProvider.tsx >/dev/null \
  || fail "Android navigation button sync missing"
rg -n "preventAutoHideAsync|if \(!ready\) return null|hideAsync" app/_layout.tsx >/dev/null \
  || fail "persisted theme hydration gate missing"
node -e "const p=require('./package.json'); if (!p.scripts.test.includes('$TEST')) process.exit(1)" \
  || fail "focused test missing from package.json test script"
ok "issue #80 implementation and regression coverage present"

echo "==> typecheck"
./node_modules/.bin/tsc --noEmit
ok "typecheck"

echo "==> focused issue #80 + token + a11y contrast tests"
node --test "$TEST" design-system/tokens/tokens.test.mjs scripts/qa-m1-21.test.mjs
ok "color token + contrast gates"

echo "==> full serialized test suite"
# shellcheck disable=SC2046
node --test --test-concurrency=1 $(node -p "require('./package.json').scripts.test.replace(/^node --test /,'')")
ok "full test suite"

echo "==> paired gallery screenshot matrix + reference parity"
test -n "$CHROME" || fail "Chrome is required for screenshot verification"
for file in index.html styles.css assets/MacroSans-VF.ttf; do
  test -f "$REFERENCE_DIR/$file" || fail "missing design-system reference: $REFERENCE_DIR/$file"
done
mkdir -p "$TMP_DIR/gallery" "$TMP_DIR/reference/light" "$TMP_DIR/reference/dark" "$TMP_DIR/screenshots"
./node_modules/.bin/esbuild scripts/issue-80-gallery-smoke.mjs \
  --bundle --platform=browser --format=esm --jsx=automatic \
  --alias:react-native=react-native-web \
  --alias:expo-navigation-bar=./scripts/issue-80-native-chrome-stub.mjs \
  --alias:expo-system-ui=./scripts/issue-80-native-chrome-stub.mjs \
  --define:process.env.NODE_ENV='"production"' \
  --outfile="$TMP_DIR/gallery/gallery.browser.js"
cp scripts/issue-80-gallery-smoke.html "$TMP_DIR/gallery/index.html"
for scheme in light dark; do
  cp "$REFERENCE_DIR/index.html" "$REFERENCE_DIR/styles.css" "$TMP_DIR/reference/$scheme/"
  mkdir -p "$TMP_DIR/reference/$scheme/assets"
  cp "$REFERENCE_DIR/assets/MacroSans-VF.ttf" "$TMP_DIR/reference/$scheme/assets/"
  sed -i "s/data-theme=\"light\"/data-theme=\"$scheme\"/" "$TMP_DIR/reference/$scheme/index.html"
  sed -i '/<script src="scripts.js"><\/script>/d' "$TMP_DIR/reference/$scheme/index.html"
done
python3 -m http.server "$PORT" --directory "$TMP_DIR" >"$TMP_DIR/http.log" 2>&1 &
SERVER_PID="$!"
for _attempt in {1..40}; do
  curl --fail --silent "$BASE_URL/gallery/index.html" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --fail --silent "$BASE_URL/gallery/index.html" >/dev/null || fail "screenshot server not ready"

capture() {
  local name="$1"
  local width="$2"
  local url="$3"
  timeout 30s "$CHROME" \
    --headless=old \
    --no-sandbox \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size="$width,1200" \
    --ozone-override-screen-size="$width,1200" \
    --screenshot="$TMP_DIR/screenshots/$name.png" \
    "$url" >>"$TMP_DIR/chrome.log" 2>&1 \
    || fail "Chrome failed to capture $name"
  test -s "$TMP_DIR/screenshots/$name.png" || fail "missing screenshot $name"
}

for width in 390 414 430; do
  for scheme in light dark; do
    capture "app-$width-$scheme" "$width" "$BASE_URL/gallery/index.html?theme=$scheme"
    capture "reference-$width-$scheme" "$width" "$BASE_URL/reference/$scheme/index.html"
  done
done
node scripts/issue-80-screenshot-parity.mjs "$TMP_DIR/screenshots"
ok "app/reference light-dark screenshot pairs passed at 390, 414, and 430 px"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-80 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "coverage: persisted-theme launch gate, semantic surfaces/state/overage tokens, theme-stable data domains, ErrorBanner token fills, StatusBar/SystemUI/Android navigation chrome sync, WCAG contrast gate"
  echo "screenshots: app + design-system reference light/dark pairs passed hierarchy and theme checks at 390, 414, and 430 px"
} | tee "$ROOT/out/issue-80-smoke-result.txt"
