import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha256File } from './checksum.mjs';
import { loadPrivateKey, loadPublicKey, signSha256Hex, verifySha256HexSignature } from './sign.mjs';

const execFileAsync = promisify(execFile);

async function zstdAvailable() {
  try {
    await execFileAsync('zstd', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress FoodSeed.sqlite with zstd (preferred) or gzip fallback.
 * @param {string} dbPath
 * @param {{ compression?: 'zstd'|'gzip', outDir?: string }} [opts]
 */
export async function compressFoodSeed(dbPath, opts = {}) {
  const outDir = opts.outDir || join(dbPath, '..');
  const uncompressed = await readFile(dbPath);
  const uncompressedBytes = uncompressed.length;
  const uncompressedSha256 = createHash('sha256').update(uncompressed).digest('hex');

  let want = opts.compression || 'zstd';
  if (want === 'zstd' && !(await zstdAvailable())) {
    want = 'gzip';
  }

  let compression;
  let artifactPath;
  let compressedBytes;

  if (want === 'zstd') {
    compression = 'zstd';
    artifactPath = join(outDir, 'FoodSeed.sqlite.zst');
    try {
      await unlink(artifactPath);
    } catch {
      /* ok */
    }
    await execFileAsync('zstd', ['-19', '-q', '-f', '-o', artifactPath, dbPath]);
    compressedBytes = (await readFile(artifactPath)).length;
  } else {
    compression = 'gzip';
    artifactPath = join(outDir, 'FoodSeed.sqlite.gz');
    const gz = gzipSync(uncompressed, { level: 9 });
    await writeFile(artifactPath, gz);
    compressedBytes = gz.length;
  }

  await access(artifactPath);
  const sha256 = await sha256File(artifactPath);
  return {
    artifactPath,
    compression,
    compressedBytes,
    uncompressedBytes,
    sha256,
    uncompressedSha256,
  };
}

/**
 * Build signed SeedManifest for the compressed artifact.
 * Signature covers the lowercase SHA-256 hex of the **compressed** artifact (utf8 bytes).
 *
 * @param {object} opts
 */
export async function writeSignedManifest(opts) {
  const {
    outDir,
    seedVersion,
    createdAt,
    mode,
    content,
    sources,
    packaged,
    releaseNotes,
    privateKeyPath,
  } = opts;

  const { key: privateKey, keyId } = await loadPrivateKey(privateKeyPath);
  const signature = signSha256Hex(packaged.sha256, privateKey);

  const { key: publicKey } = await loadPublicKey();
  if (!verifySha256HexSignature(packaged.sha256, signature, publicKey)) {
    throw new Error('ed25519 self-verify failed after sign');
  }

  const artifactName =
    packaged.compression === 'zstd' ? 'FoodSeed.sqlite.zst' : 'FoodSeed.sqlite.gz';

  const manifest = {
    manifestVersion: 1,
    catalogSchemaVersion: 1,
    seedVersion,
    minimumAppBuild: 1,
    createdAt,
    buildMode: mode,
    artifact: {
      url: `file://${join(outDir, artifactName)}`,
      compression: packaged.compression,
      compressedBytes: packaged.compressedBytes,
      uncompressedBytes: packaged.uncompressedBytes,
      sha256: packaged.sha256,
      signature,
      signingKeyID: keyId,
    },
    content,
    sources,
    releaseNotes:
      releaseNotes ||
      `M1-08 ${mode} FoodSeed emit (${content.foodCount} foods, ${packaged.compression})`,
    pinnedSourcesFile: 'pinned-sources.json',
    uncompressedSha256: packaged.uncompressedSha256,
  };

  const manifestPath = join(outDir, 'seed-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath, signature, keyId };
}

/**
 * Compress + sign packaging step for an already-built FoodSeed.sqlite.
 */
export async function packageFoodSeed(opts) {
  const {
    dbPath,
    outDir,
    seedVersion,
    createdAt = new Date().toISOString(),
    mode = 'fixture',
    content,
    sources,
    releaseNotes,
    compression = 'zstd',
    privateKeyPath,
  } = opts;

  const packaged = await compressFoodSeed(dbPath, { compression, outDir });
  const signed = await writeSignedManifest({
    outDir,
    seedVersion,
    createdAt,
    mode,
    content,
    sources,
    packaged,
    releaseNotes,
    privateKeyPath,
  });

  return { ...packaged, ...signed };
}
