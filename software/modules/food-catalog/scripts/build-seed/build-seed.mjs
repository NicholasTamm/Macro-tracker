#!/usr/bin/env node
/**
 * M1-06 USDA seed build pipeline.
 *
 * Default: consume golden fixture under ./fixture (no network).
 * Full:    USE_FULL_USDA=1 downloads pinned Foundation + SR Legacy zips,
 *          verifies SHA-256, extracts, and normalizes (still does not emit
 *          the full 2k–5k curated selection — that is M1-07).
 *
 * Usage:
 *   node build-seed.mjs [--out <dir>] [--seed-version <ver>] [--limit <n>]
 *   USE_FULL_USDA=1 node build-seed.mjs [--out <dir>]
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeUsdaDirectory, loadPinnedSources, loadNutrientMap } from './lib/normalize.mjs';
import { downloadAndVerify, unzipArchive, findCsvRoot } from './lib/download.mjs';
import { emitSqliteCatalog } from './lib/emit-sqlite.mjs';
import { sha256Hex, assertSha256 } from './lib/checksum.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {
    outDir: join(__dirname, 'out'),
    seedVersion: null,
    limit: null,
    useFull: process.env.USE_FULL_USDA === '1' || process.env.USE_FULL_USDA === 'true',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out') out.outDir = argv[++i];
    else if (a === '--seed-version') out.seedVersion = argv[++i];
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--full') out.useFull = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return out;
}

async function resolveInputDirs(args, pinned) {
  if (!args.useFull) {
    return {
      mode: 'fixture',
      dirs: [
        { sourceId: 'usda-foundation', path: join(__dirname, 'fixture/foundation') },
        { sourceId: 'usda-sr-legacy', path: join(__dirname, 'fixture/sr_legacy') },
      ],
      sourceOverrides: pinned.sources.map((s) => ({
        sourceId: s.sourceId,
        // Fixture builds still record the *pinned* archive URL/hash as provenance,
        // with an explicit fixture marker in release notes / build_mode.
        releaseVersion: `${s.releaseVersion}+fixture`,
        releaseDate: s.releaseDate,
        sourceUrl: s.sourceUrl,
        archiveSha256: s.archiveSha256,
        retrievedAt: new Date().toISOString(),
      })),
    };
  }

  const cacheDir = join(__dirname, 'cache');
  await mkdir(cacheDir, { recursive: true });
  const dirs = [];
  const sourceOverrides = [];

  for (const src of pinned.sources) {
    const zipPath = join(cacheDir, src.archiveFileName);
    console.log(`==> download ${src.sourceId}: ${src.sourceUrl}`);
    const dl = await downloadAndVerify({
      url: src.sourceUrl,
      destPath: zipPath,
      expectedSha256: src.archiveSha256,
    });
    console.log(`    sha256 ok (${dl.downloaded ? 'downloaded' : 'cached'})`);
    const extractDir = join(cacheDir, `extract-${src.sourceId}`);
    await unzipArchive(zipPath, extractDir);
    const csvRoot = await findCsvRoot(extractDir);
    dirs.push({ sourceId: src.sourceId, path: csvRoot });
    sourceOverrides.push({
      sourceId: src.sourceId,
      releaseVersion: src.releaseVersion,
      releaseDate: src.releaseDate,
      sourceUrl: src.sourceUrl,
      archiveSha256: src.archiveSha256,
      retrievedAt: new Date().toISOString(),
    });
  }

  return { mode: 'full', dirs, sourceOverrides };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node build-seed.mjs [--out dir] [--seed-version ver] [--limit n] [--full]
Env: USE_FULL_USDA=1 to fetch pinned USDA archives (checksum-verified).`);
    process.exit(0);
  }

  const pinned = await loadPinnedSources();
  const nutrientMap = await loadNutrientMap();
  const input = await resolveInputDirs(args, pinned);

  const seedVersion =
    args.seedVersion ||
    (input.mode === 'fixture' ? '2026.10.03.fixture.1' : '2026.10.03.full.1');

  /** @type {object[]} */
  let allFoods = [];
  const allRejected = [];

  for (const dir of input.dirs) {
    console.log(`==> normalize ${dir.sourceId} from ${dir.path}`);
    const result = await normalizeUsdaDirectory(dir.path, {
      nutrientMap,
      limit: args.limit,
    });
    console.log(`    foods=${result.foods.length} rejected=${result.rejected.length}`);
    allFoods = allFoods.concat(result.foods);
    allRejected.push(...result.rejected.map((r) => ({ ...r, sourceId: dir.sourceId })));
  }

  // Deduplicate by foodId (Foundation wins if ever overlapping external ids across sources — different prefixes so rare)
  const byId = new Map();
  for (const f of allFoods) {
    if (!byId.has(f.foodId)) byId.set(f.foodId, f);
  }
  allFoods = [...byId.values()].sort((a, b) => a.foodId.localeCompare(b.foodId));

  await mkdir(args.outDir, { recursive: true });
  if (allRejected.length) {
    await writeFile(
      join(args.outDir, 'rejected.json'),
      `${JSON.stringify(allRejected, null, 2)}\n`,
    );
  }

  console.log(`==> emit sqlite (${allFoods.length} foods) → ${args.outDir}`);
  const emitted = await emitSqliteCatalog({
    foods: allFoods,
    pinnedSources: pinned,
    seedVersion,
    outDir: args.outDir,
    mode: input.mode,
    sourceOverrides: input.sourceOverrides,
  });

  console.log(`OK: ${emitted.dbPath}`);
  console.log(`OK: ${emitted.manifestPath}`);
  console.log(`    foods=${emitted.manifest.content.foodCount} sha256=${emitted.manifest.artifact.sha256.slice(0, 12)}…`);
  for (const s of emitted.manifest.sources) {
    console.log(`    source ${s.id} release=${s.release} archive_sha256=${s.archiveSHA256.slice(0, 12)}…`);
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message || err);
  if (err.code === 'CHECKSUM_MISMATCH') {
    console.error('  expected:', err.expected);
    console.error('  actual:  ', err.actual);
  }
  process.exit(1);
});
