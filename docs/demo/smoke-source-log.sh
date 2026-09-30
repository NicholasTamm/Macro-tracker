#!/usr/bin/env bash
# Issue #15 smoke demo: validate Expo-reconciled primary-source verification log.
# Checks file presence, section headings, status key, Expo supersession, and bottom-line keywords.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
LOG="$DOCS_DIR/issue-15-source-verification-log.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-15-smoke-result.txt"

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

echo "==> [1/6] Source verification log exists"
test -f "$LOG" || { echo "missing $LOG" >&2; exit 1; }
BYTES="$(wc -c < "$LOG" | tr -d ' ')"
LINES="$(wc -l < "$LOG" | tr -d ' ')"
echo "    path=$LOG bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 15000
test "$LINES" -gt 120

echo "==> [2/6] Required section headings"
for h in \
  "## Supersession notice" \
  "## Status key" \
  "## Expo implementation implications (from verified sources)" \
  "## 1. MacroFactor product, trial, and storefront pricing" \
  "## 2. USDA FoodData Central" \
  "## 3. Open Food Facts" \
  "## 4. FatSecret Platform API" \
  "## 5. Edamam, Spoonacular, and Nutritionix" \
  "## 6. Canadian Nutrient File and ANSES-Ciqual" \
  "## 7. Primary/authoritative sources for an original adaptive algorithm" \
  "## 8. Explicit unresolved claims and confirmation paths" \
  "## Bottom line for Expo implementation"
do
  check "heading: $h" grep -Fqx "$h" "$LOG"
done

echo "==> [3/6] Expo supersession + stack keywords"
for kw in \
  "Expo" \
  "React Native" \
  "expo-sqlite" \
  "Supersession notice" \
  "TransparentTrend v1" \
  "Play Billing" \
  "Health Connect" \
  "No MacroFactor" \
  "FoodSeed.sqlite" \
  "server-proxied" \
  "issue-12-food-schema-seed-contract.md"
do
  check "keyword: $kw" grep -Fq "$kw" "$LOG"
done

echo "==> [4/6] Status key + claim statuses present"
for st in \
  "**VERIFIED**" \
  "**PARTIALLY VERIFIED**" \
  "**UNVERIFIED**" \
  "UNVERIFIED — LEGAL"
do
  check "status: $st" grep -Fq "$st" "$LOG"
done

echo "==> [5/6] Critical source rows / URLs"
for item in \
  "fdc.nal.usda.gov" \
  "openfoodfacts" \
  "platform.fatsecret.com" \
  "nutritionix.com" \
  "open.canada.ca" \
  "ciqual.anses.fr" \
  "itl.nist.gov" \
  "CC0" \
  "ODbL"
do
  check "source: $item" grep -Fq "$item" "$LOG"
done

echo "==> [6/6] Policy guards (no competitor price as our offer; cross-platform SKU gap)"
check "bottom-line USDA local" grep -Fq "USDA Foundation + SR Legacy local" "$LOG"
check "never competitor prices as ours" grep -Fq "Never use MacroFactor prices as ours" "$LOG"
check "cross-platform SKU gap row" grep -Fq "Google Play SKU" "$LOG"
# Guard: must not present MacroFactor dollar amounts as our live offer policy.
if grep -Eiq 'our (price|offer|plan|sku).{0,60}\$[0-9]' "$LOG"; then
  echo "    FAIL hard-coded own-price policy language" >&2
  fail=$((fail + 1))
else
  echo "    OK  no hard-coded own-price policy string"
  pass=$((pass + 1))
fi

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-15 source verification log ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-15 source verification log ($STAMP)"
  echo "pass=$pass fail=0"
  echo "log=$LOG"
  echo "bytes=$BYTES lines=$LINES"
  echo "sections=12 statuses=VERIFIED,PARTIALLY_VERIFIED,UNVERIFIED"
} | tee "$REPORT"

echo "Report: $REPORT"
