#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

test -f modules/food-catalog/schema/user-store-v1.sql || fail "missing user-store-v1.sql"
test -f modules/app-core/user-data/index.ts || fail "missing user-data module"
test -f modules/app-core/user-data/user-data.test.mjs || fail "missing tests"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi

node --test modules/app-core/user-data/user-data.test.mjs
ok "user-data tests"

npx tsc --noEmit
ok "typecheck"

mkdir -p "$ROOT/out"
echo "smoke-m1-05-user-store PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-34-smoke-result.txt"
