#!/usr/bin/env bash
# M1-64 smoke (#122): placeholder mascot (six poses) + EmptyState illustration slot.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${ISSUE_122_SMOKE_PORT:-18122}"
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
  rm -rf "$TMP_DIR" "$ROOT/software/.smoke-web-122"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  if [[ -f "$TMP_DIR/chrome.log" ]]; then tail -40 "$TMP_DIR/chrome.log" >&2; fi
  exit 1
}
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
npx expo export --platform web --output-dir "$OUT" >/dev/null 2>&1 || fail "web export failed"
for f in wave think cheer sleep scale empty-plate; do
  find "$OUT" -path '*mascot*' -name "placeholder-$f*.svg" | grep -q . || fail "pose $f not in web bundle"
done
ok "web bundle has all six poses"

echo "==> light/dark mascot gallery screenshots"
test -n "$CHROME" || fail "Chrome is required for screenshot verification"
mkdir -p "$TMP_DIR/gallery" "$TMP_DIR/screenshots"
./node_modules/.bin/esbuild scripts/issue-80-gallery-smoke.mjs \
  --bundle --platform=browser --format=esm --jsx=automatic \
  --loader:.svg=file --loader:.ttf=file \
  --alias:react-native=react-native-web \
  --alias:expo-font=./scripts/issue-122-expo-font-stub.mjs \
  --alias:expo-image=./scripts/issue-122-expo-image-stub.mjs \
  --alias:expo-navigation-bar=./scripts/issue-80-native-chrome-stub.mjs \
  --alias:expo-system-ui=./scripts/issue-80-native-chrome-stub.mjs \
  --define:__DEV__=false \
  --define:process.env.EXPO_OS='"web"' \
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
    --window-size=430,3000 \
    --ozone-override-screen-size=430,3000 \
    --virtual-time-budget=1000 \
    --screenshot="$TMP_DIR/screenshots/gallery-$scheme.png" \
    "$BASE_URL/gallery/index.html?theme=$scheme" >>"$TMP_DIR/chrome.log" 2>&1 \
    || fail "Chrome failed to capture $scheme mascot gallery"
  test -s "$TMP_DIR/screenshots/gallery-$scheme.png" || fail "missing $scheme gallery screenshot"
done
node scripts/issue-122-gallery-screenshot.mjs \
  "$TMP_DIR/screenshots/gallery-light.png" "$TMP_DIR/screenshots/gallery-dark.png"
ok "light/dark mascot gallery screenshots"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-122 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "screenshots: all six mascot poses and the mascot empty state rendered unclipped in light and dark"
} > "$ROOT/out/issue-122-smoke-result.txt"
ok "wrote out/issue-122-smoke-result.txt"
