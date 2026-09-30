#!/usr/bin/env bash
# Issue #19 smoke demo: validate Expo sync architecture ADR markdown.
# Checks file presence, section headings, option table, conflict policy, M1 local-only, no CloudKit-as-SoR.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
ADR="$DOCS_DIR/issue-19-sync-architecture.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-19-smoke-result.txt"

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

echo "==> [1/6] Sync architecture ADR exists"
test -f "$ADR" || { echo "missing $ADR" >&2; exit 1; }
BYTES="$(wc -c < "$ADR" | tr -d ' ')"
LINES="$(wc -l < "$ADR" | tr -d ' ')"
echo "    path=$ADR bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 8000
test "$LINES" -gt 150

echo "==> [2/6] Required section headings"
for h in \
  "## Supersession notice" \
  "## Decision summary (ADR)" \
  "## 1. Goals and non-goals" \
  "## 2. Option comparison (cross-platform)" \
  "## 3. Sync plane vs non-sync plane" \
  "## 4. Identifiers, tombstones, conflict policy" \
  "## 5. Export, restore, DR, provider exit" \
  "## 6. Milestone mapping" \
  "## 7. Acceptance checklist (maps to #19)" \
  "## Bottom line"
do
  check "heading: $h" grep -Fqx "$h" "$ADR"
done

echo "==> [3/6] Expo supersession + stack keywords"
for kw in \
  "Expo" \
  "React Native" \
  "expo-sqlite" \
  "Supersession notice" \
  "UserData.sqlite" \
  "FoodSeed.sqlite" \
  "PowerSync" \
  "Postgres" \
  "No MacroFactor" \
  "issue-12-food-schema-seed-contract.md"
do
  check "keyword: $kw" grep -Fq "$kw" "$ADR"
done

echo "==> [4/6] Option comparison + rejected CloudKit-as-SoR"
for item in \
  "No-sync / manual backup" \
  "PowerSync + Postgres" \
  "Custom REST/GraphQL sync over Postgres" \
  "Firebase Firestore" \
  "CloudKit (private DB) as SoR" \
  "**Rejected as SoR.**" \
  "**M1 default.**" \
  "**Preferred M2+ candidate.**"
do
  check "option: $item" grep -Fq "$item" "$ADR"
done

echo "==> [5/6] Conflict policy + sync exclusions"
for item in \
  "stable UUID" \
  "tombstone" \
  "Last-writer-wins" \
  "Offline replay" \
  "Duplicate repair" \
  "user_store_schema_version" \
  "**Never**" \
  "license-restricted"
do
  check "policy: $item" grep -Fq "$item" "$ADR"
done

echo "==> [6/6] Policy guards (M1 local-only; CloudKit not SoR; export free)"
check "M1 local-only" grep -Fq "**Local-only.**" "$ADR"
check "CloudKit rejected as SoR" grep -Fq "CloudKit is **not** the default SoR" "$ADR"
check "export free ungated" grep -Fq "Export (free)" "$ADR"
check "catalog never syncs" grep -Fq '`FoodSeed.sqlite` | **Never**' "$ADR"
# Guard: must not affirmatively re-adopt CloudKit as the default system of record.
# Rejection phrases ("not the default", "Rejected as SoR") are expected and allowed.
if grep -Ein 'cloudkit' "$ADR" | grep -Eiv 'not|reject|never|incompatible|apple-only|optional' | grep -Eiq '(default|chosen|use for).{0,60}(sor|system of record|mvp sync)'; then
  echo "    FAIL CloudKit re-adopted as default SoR" >&2
  fail=$((fail + 1))
else
  echo "    OK  CloudKit not re-adopted as default SoR"
  pass=$((pass + 1))
fi

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-19 sync architecture ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-19 sync architecture ($STAMP)"
  echo "pass=$pass fail=0"
  echo "adr=$ADR"
  echo "bytes=$BYTES lines=$LINES"
  echo "sections=10 m1=local-only cloudkit_sor=rejected"
} | tee "$REPORT"

echo "Report: $REPORT"
