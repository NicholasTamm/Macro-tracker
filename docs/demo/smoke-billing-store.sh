#!/usr/bin/env bash
# Issue #23 smoke demo: validate Expo-reconciled billing / store-ops markdown.
# Checks file presence, headings, one logical entitlement, StoreKit+Play mapping,
# localized prices, no hard-coded competitor pricing, M3 timing, restore/purchase flows.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
DOC="$DOCS_DIR/issue-23-billing-store-ops.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-23-smoke-result.txt"

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

echo "==> [1/7] Billing / store-ops document exists"
test -f "$DOC" || { echo "missing $DOC" >&2; exit 1; }
BYTES="$(wc -c < "$DOC" | tr -d ' ')"
LINES="$(wc -l < "$DOC" | tr -d ' ')"
echo "    path=$DOC bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 6000
test "$LINES" -gt 100

echo "==> [2/7] Required section headings"
for h in \
  "## Supersession notice" \
  "## Goal" \
  "## Logical entitlement model" \
  "## Localized prices and offers (no hard-coded competitor pricing)" \
  "## Milestone timing" \
  "## Architecture (Expo)" \
  "## Purchase and restore flows" \
  "## Lifecycle test matrix (M3-10 acceptance)" \
  "## Server notifications and backend entitlement (before premium backend access)" \
  "## Storefront evidence (M3-18)" \
  "## Store copy and subscription disclosure" \
  "## Milestone / task mapping" \
  "## Out of scope for this docs PR" \
  "## Bottom line"
do
  check "heading: $h" grep -Fqx "$h" "$DOC"
done

echo "==> [3/7] Expo supersession + cross-platform stores"
for kw in \
  "Expo" \
  "React Native" \
  "Supersession notice" \
  "StoreKit" \
  "Play Billing" \
  "entitlement service" \
  "premium.monthly" \
  "premium.annual" \
  "No MacroFactor" \
  "software/modules/paywall" \
  "Never paste a competitor"
do
  check "keyword: $kw" grep -Fq "$kw" "$DOC"
done

echo "==> [4/7] Logical entitlement states + product family"
for item in \
  "\`free\`" \
  "\`premiumTrial\`" \
  "\`premium\`" \
  "\`premiumGrace\`" \
  "Identical" \
  "billing discount only" \
  "one logical premium entitlement"
do
  check "item: $item" grep -Fq "$item" "$DOC"
done

echo "==> [5/7] Purchase / restore / lifecycle coverage"
for item in \
  "Restore Purchases" \
  "Manage Subscription" \
  "Pending" \
  "Refund" \
  "Revoke" \
  "Billing retry" \
  "Offline with valid cache" \
  "Account switch" \
  "Always-free after lapse"
do
  check "flow: $item" grep -Fq "$item" "$DOC"
done

echo "==> [6/7] M3 timing + server notifications + free features"
for item in \
  "**M3**" \
  "M3-09" \
  "M3-10" \
  "M3-11" \
  "M3-18" \
  "App Store Server Notifications" \
  "Real-time Developer Notifications" \
  "manual diary" \
  "CSV/JSON" \
  "local USDA"
do
  check "item: $item" grep -Fq "$item" "$DOC"
done

echo "==> [7/7] Policy guards (localized prices; no competitor/static USD as live policy)"
check "store-localized display" grep -Fq "Display price string (localized currency)" "$DOC"
check "forbidden competitor prices" grep -Fq "Competitor app prices" "$DOC"
check "M1 no IAP" grep -Fq "No IAP" "$DOC"
check "do not commit live price strings" grep -Fq "do not commit live price strings" "$DOC"
# Guard: doc must not present a hard-coded own/competitor dollar amount as live offer policy.
if grep -Eiq '(our (price|offer|plan)|competitor.{0,40}(price|costs?)).{0,40}\$[0-9]' "$DOC"; then
  echo "    FAIL hard-coded price-as-policy language" >&2
  fail=$((fail + 1))
else
  echo "    OK  no hard-coded price-as-policy string"
  pass=$((pass + 1))
fi
# Extra guard: no bare $N.NN retail claims as "we charge"
if grep -Eiq 'we charge \$[0-9]|priced at \$[0-9]|\$[0-9]+\.[0-9]{2}/(mo|month|yr|year)' "$DOC"; then
  echo "    FAIL static retail price claim in doc" >&2
  fail=$((fail + 1))
else
  echo "    OK  no static retail price claim"
  pass=$((pass + 1))
fi

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-23 billing store ops ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-23 billing store ops ($STAMP)"
  echo "pass=$pass fail=0"
  echo "doc=$DOC"
  echo "bytes=$BYTES lines=$LINES"
  echo "sections=14 entitlements=free,premiumTrial,premium,premiumGrace stores=StoreKit+Play"
} | tee "$REPORT"

echo "Report: $REPORT"
