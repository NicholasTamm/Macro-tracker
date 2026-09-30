#!/usr/bin/env bash
# Issue #24 smoke demo: validate Expo-reconciled accessibility / localization audit markdown.
# Checks file presence, headings, VoiceOver/TalkBack, Dynamic Type, Reduce Motion, themes,
# locales/RTL, nutrient-not-color-alone, severity rubric, and beta gates.
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMO_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
DOC="$DOCS_DIR/issue-24-accessibility-localization.md"
OUT_DIR="$REPO_ROOT/out"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/issue-24-smoke-result.txt"

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

echo "==> [1/8] Accessibility/localization document exists"
test -f "$DOC" || { echo "missing $DOC" >&2; exit 1; }
BYTES="$(wc -c < "$DOC" | tr -d ' ')"
LINES="$(wc -l < "$DOC" | tr -d ' ')"
echo "    path=$DOC bytes=$BYTES lines=$LINES"
test "$BYTES" -gt 8000
test "$LINES" -gt 120

echo "==> [2/8] Required section headings"
for h in \
  "## Supersession notice" \
  "## Scope (before external beta)" \
  "## Current scaffold snapshot (M1 design system)" \
  "## VoiceOver (iOS) checklist" \
  "## TalkBack (Android) checklist" \
  "## Dynamic Type / font scaling checklist" \
  "## Touch targets, contrast, color-blind, Increase Contrast" \
  "## Reduce Motion, Voice Control / switch, keyboard / web focus" \
  "## Themes + offline / error / empty / loading" \
  "## Locales, RTL, numbers, dates, units, plurals" \
  "## Nutrient meaning — not by color alone (binding)" \
  "## Evidence log template" \
  "## Review gates (before betas)" \
  "## Milestone posture" \
  "## Remediations already visible (file under #13 / M1-21 — not this PR)" \
  "## Bottom line"
do
  check "heading: $h" grep -Fqx "$h" "$DOC"
done

echo "==> [3/8] Expo supersession + AT / platform keywords"
for kw in \
  "Expo" \
  "React Native" \
  "Supersession notice" \
  "VoiceOver" \
  "TalkBack" \
  "AccessibilityInfo" \
  "I18nManager" \
  "No MacroFactor" \
  "M1-21" \
  "design-system"
do
  check "keyword: $kw" grep -Fq "$kw" "$DOC"
done

echo "==> [4/8] Dynamic Type, touch targets, contrast, themes"
for item in \
  "Dynamic Type" \
  "44×44" \
  "allowFontScaling" \
  "maxFontSizeMultiplier" \
  "WCAG AA" \
  "Increase Contrast" \
  "color-blind" \
  "light" \
  "dark" \
  "ThemeProvider"
do
  check "item: $item" grep -Fq "$item" "$DOC"
done

echo "==> [5/8] Reduce Motion + assistive access"
for item in \
  "Reduce Motion" \
  "isReduceMotionEnabled" \
  "Voice Control" \
  "Switch Control" \
  "keyboard" \
  "Reanimated" \
  "Haptics"
do
  check "control: $item" grep -Fq "$item" "$DOC"
done

echo "==> [6/8] Locales / RTL / formatters + state surfaces"
for item in \
  "RTL" \
  "expo-localization" \
  "Intl.NumberFormat" \
  "plurals" \
  "OfflinePill" \
  "ErrorBanner" \
  "EmptyState" \
  "LoadingState" \
  "marginStart"
do
  check "locale: $item" grep -Fq "$item" "$DOC"
done

echo "==> [7/8] Nutrient-not-color-alone + severity + gates"
for item in \
  "not by color alone" \
  "MacroSummary" \
  "textual summary" \
  "Critical" \
  "External beta" \
  "M2-19" \
  "M3-19" \
  "issue-13-mvp-backlog.md"
do
  check "gate: $item" grep -Fq "$item" "$DOC"
done

echo "==> [8/8] Policy guards (no MacroFactor IP; docs-only remediations)"
check "hard exclusion MacroFactor" grep -Fq "No MacroFactor trademarks" "$DOC"
check "docs-only no primary impl" grep -Fq "no primary implementation edits" "$DOC"
check "bottom-line VoiceOver and TalkBack" grep -Fq "VoiceOver and TalkBack" "$DOC"
check "nutrient never color alone bottom line" grep -Fq "nutrient meaning never by color alone" "$DOC"
# Guard: must not claim external beta already cleared.
if grep -Eiq 'external beta (is )?(cleared|approved|complete|passed)' "$DOC"; then
  echo "    FAIL premature external-beta clearance claim" >&2
  fail=$((fail + 1))
else
  echo "    OK  no premature external-beta clearance"
  pass=$((pass + 1))
fi
# Guard: PrimaryButton 44 gap must remain acknowledged until impl lands.
check "PrimaryButton 44 gap acknowledged" grep -Fq "minHeight\` 42" "$DOC"

echo
if [[ "$fail" -ne 0 ]]; then
  {
    echo "SMOKE FAIL — issue-24 accessibility/localization ($STAMP)"
    echo "pass=$pass fail=$fail"
  } | tee "$REPORT"
  exit 1
fi

{
  echo "SMOKE OK — issue-24 accessibility/localization ($STAMP)"
  echo "pass=$pass fail=0"
  echo "doc=$DOC"
  echo "bytes=$BYTES lines=$LINES"
  echo "sections=16 surfaces=VoiceOver,TalkBack,DynamicType,ReduceMotion,Themes,Locales"
} | tee "$REPORT"

echo "Report: $REPORT"
