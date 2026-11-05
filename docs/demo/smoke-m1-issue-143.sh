#!/usr/bin/env bash
# M1-77 (#143): inset endpoint dots; one daily mean without changing summaries.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d "$ROOT/software/.smoke-143-XXXXXX")"
SERVER_PID=""
PORT="${ISSUE_143_SMOKE_PORT:-18143}"
CHROME="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
cd "$ROOT/software"

rg -q 'summary = useMemo\(\(\) => summarizeWeights\(windowed\)' 'app/(tabs)/analytics.tsx'
rg -q 'newestFirst = useMemo\(\(\) => samples.slice\(\).reverse\(\)' 'app/(tabs)/analytics.tsx'
echo '==> typecheck'; npx tsc --noEmit
echo '==> lint'; npm run -s lint
echo '==> focused regression tests'
node --test --test-concurrency=1 scripts/issue-143-weight-chart.test.mjs modules/app-core/weight/weight.test.mjs
echo '==> full test suite (concurrency 1)'
# Run exactly the package.json test list, serialized to avoid shared fixture races.
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const script = JSON.parse(readFileSync('package.json', 'utf8')).scripts.test;
execFileSync(process.execPath, ['--test', '--test-concurrency=1', ...script.replace(/^node --test /, '').split(/\s+/)], { stdio: 'inherit' });
JS

echo '==> browser geometry (production WeightChart, React Native Web, light/dark)'
test -n "$CHROME"
./node_modules/.bin/esbuild scripts/issue-143-chart-smoke.mjs \
  --bundle --platform=browser --format=iife --jsx=automatic \
  --alias:react-native=react-native-web \
  --alias:@/design-system=./design-system/theme/ThemeProvider.tsx \
  --alias:expo-navigation-bar=./scripts/issue-80-native-chrome-stub.mjs \
  --alias:expo-system-ui=./scripts/issue-80-native-chrome-stub.mjs \
  --loader:.ttf=file \
  --resolve-extensions=.web.tsx,.tsx,.web.ts,.ts,.web.jsx,.jsx,.web.js,.js,.json \
  --define:process.env='{}' --define:process.env.NODE_ENV='"production"' --define:__DEV__=false --outfile="$TMP_DIR/chart.js"
cat > "$TMP_DIR/index.html" <<'HTML'
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weight chart #143</title><style>body{margin:0}#root{width:390px;max-width:100%}</style></head><body><div id="root"></div><script src="chart.js"></script></body></html>
HTML
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$TMP_DIR" >"$TMP_DIR/http.log" 2>&1 &
SERVER_PID="$!"
for _attempt in {1..40}; do
  curl --fail --silent "http://127.0.0.1:$PORT" >/dev/null && break
  sleep 0.25
done
for scheme in light dark; do
  timeout 30s "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --no-first-run --no-default-browser-check --disable-background-networking \
    --disable-dev-shm-usage --timeout=10000 \
    --force-device-scale-factor=1 \
    --window-size=390,844 --ozone-override-screen-size=390,844 \
    --virtual-time-budget=5000 --dump-dom "http://127.0.0.1:$PORT/?theme=$scheme" \
    >"$TMP_DIR/$scheme.html" 2>"$TMP_DIR/chrome-$scheme.log"
  rg -q "ISSUE_143_BROWSER_PASS $scheme" "$TMP_DIR/$scheme.html" || {
    cat "$TMP_DIR/$scheme.html"; exit 1;
  }
done
mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-143 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo 'PASS: typecheck, lint, focused weight regressions, full package.json test suite (--test-concurrency=1).'
  echo 'PASS: Chrome 390x844 light/dark rendered the production WeightChart through React Native Web.'
  echo 'Browser geometry: every 10px dot lies fully within plot bounds (including first/last day); one mean per civil day; single-day flat series centered.'
  echo 'Repro: Oct 8/15/22/30, including 80.9 and 80.4 on Oct 30, renders four daily dots; today mean 80.65 kg. Summary/list retain all five entries.'
  echo 'Browser scope: isolated production chart; full Analytics CRUD flow not browser-automated.'
} > "$ROOT/out/issue-143-smoke-result.txt"
echo 'OK: wrote out/issue-143-smoke-result.txt'
