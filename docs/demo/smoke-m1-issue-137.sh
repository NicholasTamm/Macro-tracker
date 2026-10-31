#!/usr/bin/env bash
# M1-71: neutral first paint and nonblocking SQLite startup on web.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"
TMP_DIR="$(mktemp -d "$PWD/.smoke-137-XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

echo '==> typecheck'; npx tsc --noEmit
echo '==> lint'; npm run lint
echo '==> focused startup and theme tests'
node --test scripts/issue-137-web-startup.test.mjs scripts/issue-80-color-tokens.test.mjs modules/app-core/settings/settings.test.mjs >"$TMP_DIR/focused.txt"
echo '==> full serialized test suite'
mapfile -t TEST_FILES < <(node -e "console.log(require('./package.json').scripts.test.split(' ').filter(x=>x.endsWith('.test.mjs')).join('\n'))")
node --test --test-concurrency=1 "${TEST_FILES[@]}" >"$TMP_DIR/full.txt"
echo '==> static Expo web export'
CI=1 npx expo export -p web >"$TMP_DIR/export.txt" 2>&1 || { cat "$TMP_DIR/export.txt"; exit 1; }
echo '==> Chromium first-frame, theme persistence, and long-task checks'
if [[ -n "${ISSUE_137_BASELINE_DIR:-}" ]]; then
  node scripts/issue-137-web-startup-smoke.mjs "$ISSUE_137_BASELINE_DIR" --baseline | tee "$TMP_DIR/baseline.txt"
fi
node scripts/issue-137-web-startup-smoke.mjs dist | tee "$TMP_DIR/browser.txt"
mkdir -p "$ROOT/out"
{
  echo "smoke-m1-issue-137 PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit=$(git rev-parse --short HEAD)"
  echo 'gates=tsc --noEmit; npm run lint; focused startup/theme/settings tests; full package.json suite with --test-concurrency=1; Expo static web export'
  tail -8 "$TMP_DIR/full.txt"
  echo 'browser=Chromium 390x844; COOP same-origin; COEP credentialless; application/wasm'
  echo 'checks=no orange full-screen fill in exported index.html; blocked external bundle proves pre-hydration canvas; saved Dark/Light override opposite OS; System/fresh/blocked storage follow OS; repeated reloads retain theme; every startup task <1000ms'
  echo 'timing=PerformanceObserver longtask + requestAnimationFrame computed canvas sampling; screenMs is the first frame containing the age gate; local machine timings are not the original UAT environment'
  if [[ -f "$TMP_DIR/baseline.txt" ]]; then cat "$TMP_DIR/baseline.txt"; fi
  cat "$TMP_DIR/browser.txt"
} | tee "$ROOT/out/issue-137-smoke-result.txt"
