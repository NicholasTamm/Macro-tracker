#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

test -f modules/food-catalog/schema/user-store-v2-profile.sql || fail "missing user-store-v2-profile.sql"
test -f modules/app-core/user-data/onboarding.ts || fail "missing onboarding service"
test -f modules/app-core/user-data/profileRepo.ts || fail "missing profileRepo"
test -f modules/app-core/user-data/onboarding.test.mjs || fail "missing onboarding tests"
test -f app/onboarding/adult.tsx || fail "missing adult gate screen"
test -f app/onboarding/target.tsx || fail "missing target screen"
test -f components/UserDataProvider.tsx || fail "missing UserDataProvider"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

node --test modules/app-core/user-data/user-data.test.mjs modules/app-core/user-data/onboarding.test.mjs
ok "user-data + onboarding tests"

npx tsc --noEmit
ok "typecheck"

mkdir -p "$ROOT/out"
echo "smoke-m1-10-onboarding PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-44-smoke-result.txt"
