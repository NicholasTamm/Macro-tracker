#!/usr/bin/env bash
# Issue #22 smoke demo: validate Expo-reconciled privacy/security architecture markdown.
# Checks file presence, headings, data classes, SecureStore/AsyncStorage rules, threat mitigations,
# health/AI/provider gates, and store-declaration mapping.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
DOC="$DOCS_DIR/issue-22-privacy-security.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-22-smoke-result.txt"

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

echo "==> [1/7] Privacy/security document exists"
test -f "$DOC" || { echo "missing $DOC" >&2; exit 1; }
BYTES="$(wc -c < "$DOC" | tr -d ' ')"
LINES="$(wc -l < "$DOC" | tr -d ' ')"
echo "    path=$DOC bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 8000
test "$LINES" -gt 120

echo "==> [2/7] Required section headings"
for h in \
  "## Supersession notice" \
  "## Scope and data classes" \
  "## Storage decision (Expo)" \
  "## Data-flow outline (ASCII)" \
  "## Threat model (STRIDE-style summary)" \
  "## Nutrition data flow" \
  "## Weight data flow" \
  "## Health platform (HealthKit + Health Connect)" \
  "## Provider proxy" \
  "## Entitlement / billing assertions" \
  "## Future AI photo / describe (pre-beta checklist)" \
  "## Sync (future — constrained by #19)" \
  "## Mapping to store / policy declarations" \
  "## Review gates (before betas)" \
  "## Milestone posture" \
  "## Bottom line"
do
  check "heading: $h" grep -Fqx "$h" "$DOC"
done

echo "==> [3/7] Expo supersession + SecureStore / AsyncStorage rules"
for kw in \
  "Expo" \
  "React Native" \
  "Supersession notice" \
  "expo-secure-store" \
  "AsyncStorage" \
  "UserData.sqlite" \
  "FoodSeed.sqlite" \
  "No MacroFactor" \
  "never ship in the app bundle" \
  "Health Connect"
do
  check "keyword: $kw" grep -Fq "$kw" "$DOC"
done

echo "==> [4/7] Data classes + threat mitigations present"
for item in \
  "Nutrition diary" \
  "Weight / body" \
  "Health-platform" \
  "Provider cache" \
  "Secrets / credentials" \
  "AI media" \
  "Secret management" \
  "Short-lived credentials" \
  "App attestation" \
  "Incident response" \
  "Subprocessors"
do
  check "item: $item" grep -Fq "$item" "$DOC"
done

echo "==> [5/7] Health + AI + provider controls"
for item in \
  "Granularity" \
  "Revocation" \
  "Deduplication" \
  "Logging restrictions" \
  "EXIF removal" \
  "Editable output" \
  "Manual path" \
  "Proxy-only" \
  "Wearable energy expenditure"
do
  check "control: $item" grep -Fq "$item" "$DOC"
done

echo "==> [6/7] Store declaration mapping + review gates"
for item in \
  "Privacy Manifest" \
  "App Privacy" \
  "Data safety" \
  "External network" \
  "M2-16" \
  "M3-17" \
  "issue-12-food-schema-seed-contract.md"
do
  check "map: $item" grep -Fq "$item" "$DOC"
done

echo "==> [7/7] Policy guards (no secrets in AsyncStorage; no competitor price as ours)"
check "AsyncStorage forbidden secrets row" grep -Fq "Any secret, token, API key" "$DOC"
check "commercial secrets never in bundle" grep -Fq "Commercial secrets and shared USDA production keys" "$DOC"
check "bottom-line SecureStore" grep -Fq "credentials live in **expo-secure-store**" "$DOC"
# Guard: must not present a hard-coded competitor dollar amount as our offer policy.
if grep -Eiq 'our (price|offer|plan|sku).{0,60}\$[0-9]' "$DOC"; then
  echo "    FAIL hard-coded own-price policy language" >&2
  fail=$((fail + 1))
else
  echo "    OK  no hard-coded own-price policy string"
  pass=$((pass + 1))
fi
# Guard: AsyncStorage must not be described as acceptable for secrets.
if grep -Eiq 'AsyncStorage.{0,40}(secret|api.?key|token|credential)' "$DOC" \
  && ! grep -Fq "AsyncStorage never holds secrets" "$DOC"; then
  # Allow mentions that forbid secrets; fail only if we praise AsyncStorage for secrets without the bottom-line forbid.
  if grep -Eiq 'secrets?.{0,20}(in|via|using) AsyncStorage' "$DOC"; then
    echo "    FAIL AsyncStorage endorsed for secrets" >&2
    fail=$((fail + 1))
  else
    echo "    OK  AsyncStorage secret mentions are prohibitions"
    pass=$((pass + 1))
  fi
else
  echo "    OK  AsyncStorage never-holds-secrets guard"
  pass=$((pass + 1))
fi

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-22 privacy/security ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-22 privacy/security ($STAMP)"
  echo "pass=$pass fail=0"
  echo "doc=$DOC"
  echo "bytes=$BYTES lines=$LINES"
  echo "sections=16 stores=FoodSeed,UserData,SecureStore,AsyncStorage"
} | tee "$REPORT"

echo "Report: $REPORT"
