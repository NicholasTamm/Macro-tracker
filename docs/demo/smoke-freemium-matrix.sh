#!/usr/bin/env bash
# Issue #14 smoke demo: validate Expo-reconciled freemium matrix markdown.
# Checks file presence, supersession, free/premium table, entitlement rules, M3 IAP deferral.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
MATRIX="$DOCS_DIR/issue-14-freemium-matrix.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-14-smoke-result.txt"

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "    OK  $label"
    pass=$((pass + 1))
  else
    echo "    FAIL $label" >&2
    fail=$((fail + 1))
  fi
}

echo "==> [1/6] Freemium matrix document exists"
test -f "$MATRIX" || { echo "missing $MATRIX" >&2; exit 1; }
BYTES="$(wc -c < "$MATRIX" | tr -d ' ')"
LINES="$(wc -l < "$MATRIX" | tr -d ' ')"
echo "    path=$MATRIX bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 4000
test "$LINES" -gt 80

echo "==> [2/6] Required section headings"
for h in \
  "## Supersession notice" \
  "## Product principle" \
  "## Proposed matrix (Expo-reconciled)" \
  "## Trial and products (M3 — StoreKit / Play later)" \
  "## Entitlement rules" \
  "## Paywall triggers" \
  "## Fair-use and failure behavior" \
  "## Milestone mapping (summary)"
do
  check "heading: $h" grep -Fqx "$h" "$MATRIX"
done

echo "==> [3/6] Expo supersession + hard exclusions"
for kw in \
  "Expo" \
  "React Native" \
  "Supersession notice" \
  "StoreKit" \
  "Play Billing" \
  "entitlement service" \
  "No MacroFactor" \
  "software/modules/paywall" \
  "TransparentTrend v1" \
  "Never hard-code a competitor"
do
  check "keyword: $kw" grep -Fq "$kw" "$MATRIX"
done

echo "==> [4/6] Free-forever capabilities present in matrix table"
for cap in \
  "Today diary and history" \
  "Local USDA Foundation + SR Legacy search" \
  "Manual Quick Add and custom foods" \
  "CSV/JSON export" \
  "Account/data deletion" \
  "Manual targets" \
  "Ads / data sale"
do
  check "capability: $cap" grep -Fq "$cap" "$MATRIX"
done

echo "==> [5/6] Premium-gated capabilities + entitlement IDs"
for item in \
  "Copy entire day / multi-day plans" \
  "Adaptive expenditure estimate" \
  "Weekly target check-ins" \
  "Health nutrition read/write" \
  "Multi-device sync/backup" \
  "\`free\`" \
  "\`premiumTrial\`" \
  "\`premium\`" \
  "Continue Free"
do
  check "item: $item" grep -Fq "$item" "$MATRIX"
done

echo "==> [6/6] Policy guards (no competitor price as live policy; M3 IAP deferral)"
check "M1 free posture" grep -Fq "Entire diary path is free" "$MATRIX"
check "M3 IAP row" grep -Fq "**M3**" "$MATRIX"
check "no-blocking-launch-paywall" grep -Fq "Do not show a blocking launch paywall" "$MATRIX"
# Guard: doc must not present a hard-coded competitor dollar amount as our offer policy.
if grep -Eiq 'our (price|offer|plan).{0,40}\$[0-9]' "$MATRIX"; then
  echo "    FAIL hard-coded own price policy language" >&2
  fail=$((fail + 1))
else
  echo "    OK  no hard-coded own-price policy string"
  pass=$((pass + 1))
fi

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-14 freemium matrix ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-14 freemium matrix ($STAMP)"
  echo "pass=$pass fail=0"
  echo "matrix=$MATRIX"
  echo "bytes=$BYTES lines=$LINES"
  echo "sections=8 entitlements=free,premiumTrial,premium"
} | tee "$REPORT"

echo "Report: $REPORT"
