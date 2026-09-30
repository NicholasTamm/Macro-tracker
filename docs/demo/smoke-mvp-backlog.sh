#!/usr/bin/env bash
# Issue #13 smoke demo: validate Expo-reconciled MVP backlog markdown.
# Checks file presence, milestone headings, task ID coverage, and Expo supersession keywords.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
BACKLOG="$DOCS_DIR/issue-13-mvp-backlog.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-13-smoke-result.txt"

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

echo "==> [1/5] Backlog document exists"
test -f "$BACKLOG" || { echo "missing $BACKLOG" >&2; exit 1; }
BYTES="$(wc -c < "$BACKLOG" | tr -d ' ')"
LINES="$(wc -l < "$BACKLOG" | tr -d ' ')"
echo "    path=$BACKLOG bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 5000
test "$LINES" -gt 100

echo "==> [2/5] Milestone headings present"
for h in \
  "## Milestone 1 — offline diary foundation" \
  "## Milestone 2 — packaged foods, recipes, and sync" \
  "## Milestone 3 — adaptive coaching and sustainable premium"
do
  check "heading: $h" grep -Fqx "$h" "$BACKLOG"
done

echo "==> [3/5] Task ID rows M1-01..M1-22, M2-01..M2-19, M3-01..M3-19"
missing_ids=()
for n in $(seq 1 22); do
  id="M1-$(printf '%02d' "$n")"
  if ! grep -q "| ${id} |" "$BACKLOG"; then
    missing_ids+=("$id")
  fi
done
for n in $(seq 1 19); do
  id="M2-$(printf '%02d' "$n")"
  if ! grep -q "| ${id} |" "$BACKLOG"; then
    missing_ids+=("$id")
  fi
done
for n in $(seq 1 19); do
  id="M3-$(printf '%02d' "$n")"
  if ! grep -q "| ${id} |" "$BACKLOG"; then
    missing_ids+=("$id")
  fi
done
if [[ ${#missing_ids[@]} -eq 0 ]]; then
  echo "    OK  all 60 task IDs present (22+19+19)"
  pass=$((pass + 1))
else
  echo "    FAIL missing IDs: ${missing_ids[*]}" >&2
  fail=$((fail + 1))
fi

echo "==> [4/5] Expo supersession + pointers"
for kw in \
  "Expo" \
  "React Native" \
  "expo-sqlite" \
  "Supersession notice" \
  "issue-12-food-schema-seed-contract.md" \
  "software/design-system" \
  "TransparentTrend v1" \
  "No MacroFactor"
do
  check "keyword: $kw" grep -Fq "$kw" "$BACKLOG"
done

echo "==> [5/5] P0 delivery rules + critical path"
check "P0 rule" grep -Fq '`P0`' "$BACKLOG"
check "critical path fence" grep -Fq "M1-01 → M1-05 → M1-11 → M1-13 → M1-14" "$BACKLOG"
check "non-goals M1" grep -Fq "Milestone 1 non-goals" "$BACKLOG"

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-13 MVP backlog ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-13 MVP backlog ($STAMP)"
  echo "pass=$pass fail=0"
  echo "backlog=$BACKLOG"
  echo "bytes=$BYTES lines=$LINES"
  echo "milestones=M1,M2,M3 task_ids=60"
} | tee "$REPORT"

echo "Report: $REPORT"
