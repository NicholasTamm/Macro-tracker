#!/usr/bin/env bash
# Demo for M1-02 / issue #32 — asserts CI workflow + local gates exist and pass.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

WF="docs/github-workflows/ci.yml"
ACTIVE=".github/workflows/ci.yml"
if [[ -f "$ACTIVE" ]]; then WF="$ACTIVE"; fi
test -f "$WF" || fail "missing CI workflow YAML ($WF)"
grep -q 'npm run typecheck' "$WF" || fail "workflow missing typecheck"
grep -q 'secret-scan' "$WF" || fail "workflow missing secret-scan"
ok "workflow present at $WF"
if [[ ! -f "$ACTIVE" ]]; then
  echo "NOTE: GitHub Actions file not yet at $ACTIVE (needs workflow-scope install)."
fi

cd software
test -f scripts/secret-scan.mjs || fail "missing secret-scan.mjs"
test -f package.json || fail "missing package.json"
node -e "const p=require('./package.json'); for (const s of ['typecheck','test','secret-scan','ci','lint']) { if (!p.scripts[s]) process.exit(1) }" \
  || fail "package.json missing required scripts"
ok "scripts present"

if [[ ! -d node_modules ]]; then
  echo "Installing deps (npm ci)..."
  npm ci
fi

npm run typecheck
ok "typecheck"
npm run lint
ok "lint"
npm run secret-scan
ok "secret-scan"
npm test
ok "tests"

mkdir -p "$ROOT/out"
echo "smoke-ci PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$ROOT/out/issue-32-smoke-result.txt"
