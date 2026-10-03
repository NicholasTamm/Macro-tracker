#!/usr/bin/env bash
# M1-09 smoke: LocalFoodRepository — bundle/open fixture seed, exact/FTS/fuzzy-top-50.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/software"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

REPO="modules/food-catalog/local-food-repo"
ASSET="modules/food-catalog/assets/FoodSeed.fixture.sqlite"

test -f "$REPO/LocalFoodRepository.ts" || fail "missing LocalFoodRepository.ts"
test -f "$REPO/openSeed.ts" || fail "missing openSeed.ts"
test -f "$REPO/openSeedNode.ts" || fail "missing openSeedNode.ts"
test -f "$REPO/ranking-fixtures.json" || fail "missing ranking-fixtures.json"
test -f "$REPO/BUDGET.md" || fail "missing BUDGET.md"
test -f "$REPO/local-food-repo.test.mjs" || fail "missing local-food-repo.test.mjs"
test -f "$ASSET" || fail "missing fixture seed asset"
test -f modules/food-catalog/schema/food-seed-v1.sql || fail "missing food-seed-v1.sql"

if [[ ! -d node_modules/sql.js ]]; then npm ci; fi
test -d node_modules/node-sqlite3-wasm || fail "node-sqlite3-wasm missing (npm ci)"
test -d node_modules/esbuild || fail "esbuild missing (npm ci)"

echo "==> typecheck"
npx tsc --noEmit
ok "typecheck"

echo "==> unit + ranking fixtures (includes sql.js double + warm p95)"
node --test "$REPO/local-food-repo.test.mjs"
ok "local-food-repo tests"

echo "==> warm timing sample (Node / node-sqlite3-wasm FTS5)"
TIMING="$(node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const softwareRoot = process.cwd();
const repoDir = join(softwareRoot, 'modules/food-catalog/local-food-repo');
const bundleDir = join(repoDir, '.bundle');
mkdirSync(bundleDir, { recursive: true });
writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
const esbuildBin = join(softwareRoot, 'node_modules/esbuild/bin/esbuild');
execFileSync(esbuildBin, [
  join(repoDir, 'openSeedNode.ts'), '--bundle', '--platform=node', '--format=esm',
  `--outfile=${join(bundleDir, 'openSeedNode.js')}`,
  '--external:sql.js', '--external:node-sqlite3-wasm',
], { stdio: 'pipe' });
execFileSync(esbuildBin, [
  join(repoDir, 'LocalFoodRepository.ts'), '--bundle', '--platform=node', '--format=esm',
  `--outfile=${join(bundleDir, 'LocalFoodRepository.js')}`,
], { stdio: 'pipe' });

const { openSeedFile } = await import(pathToFileURL(join(bundleDir, 'openSeedNode.js')).href);
const { LocalFoodRepository } = await import(pathToFileURL(join(bundleDir, 'LocalFoodRepository.js')).href);
const fixtures = JSON.parse(await (await import('node:fs/promises')).readFile(join(repoDir, 'ranking-fixtures.json'), 'utf8'));
const db = openSeedFile(join(softwareRoot, fixtures.seedAsset));
const repo = new LocalFoodRepository(db);
for (const c of fixtures.cases) repo.search(c.query);
const samples = [];
for (let i = 0; i < 40; i++) {
  for (const c of fixtures.cases) {
    const t0 = performance.now();
    repo.search(c.query);
    samples.push(performance.now() - t0);
  }
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * 0.95)];
const meta = repo.getMetadata();
repo.close();
if (p95 > fixtures.warmBudgetP95Ms) {
  console.error(`p95 ${p95} > budget ${fixtures.warmBudgetP95Ms}`);
  process.exit(1);
}
console.log(`p95_ms=${p95.toFixed(3)} budget_ms=${fixtures.warmBudgetP95Ms} foods=${meta.foodCount} fts=${meta.ftsAvailable}`);
NODE
)"
ok "warm timing $TIMING"

mkdir -p "$ROOT/out"
{
  echo "smoke-m1-09-local-food-repo PASS $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "seed=$ASSET"
  echo "warm=$TIMING"
  echo "budget_doc=$REPO/BUDGET.md"
  echo "fixtures=$REPO/ranking-fixtures.json"
  echo "one-command: cd software && node --test modules/food-catalog/local-food-repo/local-food-repo.test.mjs"
} | tee "$ROOT/out/issue-43-smoke-result.txt"

ok "smoke-m1-09-local-food-repo"
