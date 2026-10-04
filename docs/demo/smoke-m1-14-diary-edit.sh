#!/usr/bin/env bash
# M1-14 smoke: Diary edit/delete/undo + immutable nutrition snapshots.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

EDIT="modules/diary/entry-edit"

test -f "$EDIT/scaleSnapshotForQuantity.ts" || fail "missing scaleSnapshotForQuantity"
test -f "$EDIT/editDiaryQuantity.ts" || fail "missing editDiaryQuantity"
test -f "$EDIT/deleteAndUndo.ts" || fail "missing deleteAndUndo"
test -f "$EDIT/DiaryEntryEditSheet.tsx" || fail "missing DiaryEntryEditSheet"
test -f "$EDIT/diary-edit.test.mjs" || fail "missing diary-edit tests"
test -f "$EDIT/index.ts" || fail "missing entry-edit index"
test -f app/\(tabs\)/today.tsx || fail "missing Today screen"

rg -n "editDiaryEntryQuantity|deleteDiaryEntry|applyDiaryUndo|DiaryEntryEditSheet" app/\(tabs\)/today.tsx >/dev/null \
  || fail "Today missing edit/delete/undo wiring"
rg -n "scaleSnapshotForQuantity|editDiaryEntryQuantity" modules/diary/index.ts >/dev/null \
  || fail "diary index missing entry-edit exports"
rg -n "getDiaryEntry|updateDiaryEntryNutrition|restoreDiaryEntry" modules/app-core/user-data/diaryEntryRepo.ts >/dev/null \
  || fail "diaryEntryRepo missing get/update/restore"

# Edit path must scale from snapshot — never re-open seed repo / custom nutrients for math
rg -n "LocalFoodRepository|getCustomFood|buildSeedFoodDetail|buildCustomFoodDetail" "$EDIT" >/dev/null \
  && fail "entry-edit must not re-read seed/custom for qty math" || true
ok "entry-edit scales from immutable snapshot only"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/esbuild || fail "esbuild missing"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> diary-edit tests"
node --test "$EDIT/diary-edit.test.mjs"
ok "diary-edit tests"

echo "==> npm test (full suite)"
# Clear transient fixture locks from parallel node-sqlite3-wasm opens
rm -rf modules/food-catalog/assets/FoodSeed.fixture.sqlite.lock 2>/dev/null || true
npm test
ok "npm test"

mkdir -p "$ROOT/out"
echo "smoke-m1-14-diary-edit PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-52-smoke-result.txt"
