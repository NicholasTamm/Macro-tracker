import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { normalizeUsdaDirectory, loadPinnedSources } from './lib/normalize.mjs';
import { emitSqliteCatalog, sqliteQuery } from './lib/emit-sqlite.mjs';
import { loadPublicKey, verifySha256HexSignature, signSha256Hex, loadPrivateKey } from './lib/sign.mjs';
import { sha256File } from './lib/checksum.mjs';
import { compressFoodSeed } from './lib/package-seed.mjs';
import { validateFoodSeed } from './lib/validate-seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function fixtureFoods() {
  const foundation = await normalizeUsdaDirectory(join(__dirname, 'fixture/foundation'));
  const sr = await normalizeUsdaDirectory(join(__dirname, 'fixture/sr_legacy'));
  return [...foundation.foods, ...sr.foods];
}

test('ed25519 sign/verify round-trip on sha256 hex', async () => {
  const { key: priv } = await loadPrivateKey();
  const { key: pub } = await loadPublicKey();
  const digest = createHash('sha256').update('macro-tracker-m1-08').digest('hex');
  const sig = signSha256Hex(digest, priv);
  assert.ok(sig.length > 40);
  assert.equal(verifySha256HexSignature(digest, sig, pub), true);
  assert.equal(verifySha256HexSignature('0'.repeat(64), sig, pub), false);
});

test('emit packages FoodSeed with zstd/gzip, real SHA-256, and verifiable signature', async () => {
  const pinned = await loadPinnedSources();
  const foods = await fixtureFoods();
  const outDir = join(tmpdir(), `seed-m108-${process.pid}`);
  await rm(outDir, { recursive: true, force: true });

  const emitted = await emitSqliteCatalog({
    foods,
    pinnedSources: pinned,
    seedVersion: 'test.m1-08.1',
    outDir,
    mode: 'fixture',
    retrievedAt: '2026-10-03T12:00:00Z',
  });

  assert.ok(emitted.packaged);
  assert.ok(emitted.seedManifestPath);
  assert.match(emitted.packaged.compression, /^(zstd|gzip)$/);
  assert.ok(/^[0-9a-f]{64}$/.test(emitted.manifest.artifact.sha256));
  assert.ok(emitted.manifest.artifact.signature.length > 40);
  assert.equal(emitted.manifest.artifact.signingKeyID, 'food-seed-2026-01');
  assert.equal(emitted.manifest.catalogSchemaVersion, 1);
  assert.ok(emitted.manifest.artifact.compressedBytes < emitted.manifest.artifact.uncompressedBytes);

  const fileSha = await sha256File(emitted.packaged.artifactPath);
  assert.equal(fileSha, emitted.manifest.artifact.sha256);

  const { key: pub } = await loadPublicKey();
  assert.equal(
    verifySha256HexSignature(
      emitted.manifest.artifact.sha256,
      emitted.manifest.artifact.signature,
      pub,
    ),
    true,
  );

  // seed-manifest.json is the signed packaging artifact
  const seedManifest = JSON.parse(await readFile(emitted.seedManifestPath, 'utf8'));
  assert.equal(seedManifest.artifact.sha256, emitted.manifest.artifact.sha256);

  // build-manifest mirrors for M1-06/07 smoke compat
  const buildManifest = JSON.parse(await readFile(emitted.manifestPath, 'utf8'));
  assert.equal(buildManifest.artifact.signingKeyID, 'food-seed-2026-01');

  // Validations persisted
  const failN = await sqliteQuery(
    emitted.dbPath,
    "SELECT COUNT(*) FROM build_validation WHERE status='fail'",
  );
  assert.equal(failN, '0');
  const goldenEgg = await sqliteQuery(
    emitted.dbPath,
    "SELECT status FROM build_validation WHERE check_name='golden:egg'",
  );
  assert.equal(goldenEgg, 'pass');
  const integrity = await sqliteQuery(
    emitted.dbPath,
    "SELECT status FROM build_validation WHERE check_name='integrity_check'",
  );
  assert.equal(integrity, 'pass');
  const fk = await sqliteQuery(
    emitted.dbPath,
    "SELECT status FROM build_validation WHERE check_name='foreign_key_check'",
  );
  assert.equal(fk, 'pass');

  await rm(outDir, { recursive: true, force: true });
});

test('validateFoodSeed fails when golden query misses', async () => {
  const pinned = await loadPinnedSources();
  const foods = await fixtureFoods();
  // Drop broccoli so golden:broccoli fails
  const filtered = foods.filter((f) => f.foodId !== 'usda-sr-legacy:170379');
  const outDir = join(tmpdir(), `seed-m108-bad-${process.pid}`);
  await rm(outDir, { recursive: true, force: true });

  await assert.rejects(
    () =>
      emitSqliteCatalog({
        foods: filtered,
        pinnedSources: pinned,
        seedVersion: 'test.m1-08.bad',
        outDir,
        mode: 'fixture',
        skipPackage: true,
      }),
    (err) => err.code === 'SEED_VALIDATION_FAILED',
  );

  await rm(outDir, { recursive: true, force: true });
});

test('compressFoodSeed gzip fallback path produces matching sha256', async () => {
  const pinned = await loadPinnedSources();
  const foods = (await fixtureFoods()).slice(0, 3);
  const outDir = join(tmpdir(), `seed-m108-gz-${process.pid}`);
  await rm(outDir, { recursive: true, force: true });

  const emitted = await emitSqliteCatalog({
    foods,
    pinnedSources: pinned,
    seedVersion: 'test.m1-08.gz',
    outDir,
    mode: 'fixture',
    skipPackage: true,
    skipGolden: true,
  });

  const packaged = await compressFoodSeed(emitted.dbPath, { compression: 'gzip', outDir });
  assert.equal(packaged.compression, 'gzip');
  assert.equal(await sha256File(packaged.artifactPath), packaged.sha256);
  assert.ok(packaged.compressedBytes > 0);

  // re-validate skip golden
  const v = await validateFoodSeed(emitted.dbPath, { skipGolden: true });
  assert.ok(v.results.every((r) => r.status === 'pass'));

  await rm(outDir, { recursive: true, force: true });
});
