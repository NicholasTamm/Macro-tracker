#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

test -f modules/diary/dayKey.ts || fail "missing dayKey"
test -f modules/diary/macroTotals.ts || fail "missing macroTotals"
test -f modules/diary/loadTodayDay.ts || fail "missing loadTodayDay"
test -f modules/diary/diary.test.mjs || fail "missing diary tests"
test -f "app/(tabs)/today.tsx" || fail "missing Today screen"
test -f app/\(tabs\)/_layout.tsx || fail "missing tabs layout"

# Today tab wired
grep -q 'name="today"' "app/(tabs)/_layout.tsx" || fail "Today tab not in layout"
grep -q 'loadTodayDay' "app/(tabs)/today.tsx" || fail "Today screen missing loadTodayDay"
grep -q 'MacroSummary' "app/(tabs)/today.tsx" || fail "Today screen missing MacroSummary"
grep -q 'OfflinePill' "app/(tabs)/today.tsx" || fail "Today screen missing OfflinePill"

# Must not ship Search / food-detail UI in this issue
! grep -RIn --include='*.tsx' --include='*.ts' 'SearchScreen\|FoodDetail\|food-detail' modules/diary app/\(tabs\)/today.tsx 2>/dev/null \
  || fail "Search/food-detail leaked into M1-11 scope"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

node --test modules/diary/diary.test.mjs
ok "diary Today tests"

npx tsc --noEmit
ok "typecheck"

mkdir -p "$ROOT/out"
echo "smoke-m1-11-today PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-49-smoke-result.txt"
