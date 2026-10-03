import { mkdir, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertSha256 } from './checksum.mjs';

const execFileAsync = promisify(execFile);

/**
 * Download URL to destPath, then verify SHA-256.
 * @param {{ url: string, destPath: string, expectedSha256: string, force?: boolean }} opts
 */
export async function downloadAndVerify(opts) {
  const { url, destPath, expectedSha256, force = false } = opts;
  await mkdir(join(destPath, '..'), { recursive: true });

  let exists = false;
  try {
    await access(destPath);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !force) {
    await assertSha256(destPath, expectedSha256);
    return { path: destPath, downloaded: false };
  }

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }

  const tmp = `${destPath}.partial`;
  await pipeline(res.body, createWriteStream(tmp));
  const { rename } = await import('node:fs/promises');
  await rename(tmp, destPath);
  await assertSha256(destPath, expectedSha256);
  return { path: destPath, downloaded: true };
}

/**
 * Unzip archive into destDir using system unzip.
 * @param {string} zipPath
 * @param {string} destDir
 */
export async function unzipArchive(zipPath, destDir) {
  await mkdir(destDir, { recursive: true });
  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir]);
  return destDir;
}

/**
 * Find the directory containing food.csv inside an extracted archive root.
 * @param {string} extractRoot
 */
export async function findCsvRoot(extractRoot) {
  const { readdir, stat } = await import('node:fs/promises');
  async function walk(dir, depth = 0) {
    if (depth > 4) return null;
    const entries = await readdir(dir);
    if (entries.includes('food.csv')) return dir;
    for (const name of entries) {
      const p = join(dir, name);
      const s = await stat(p);
      if (s.isDirectory()) {
        const hit = await walk(p, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }
  const hit = await walk(extractRoot);
  if (!hit) throw new Error(`food.csv not found under ${extractRoot}`);
  return hit;
}

export { assertSha256 };
