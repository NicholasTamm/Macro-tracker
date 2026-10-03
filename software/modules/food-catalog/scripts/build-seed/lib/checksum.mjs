import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';

/** @param {Buffer | string} data */
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** @param {string} filePath */
export async function sha256File(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

/**
 * Verify file SHA-256 matches expected (lowercase hex).
 * @param {string} filePath
 * @param {string} expectedSha256
 * @returns {Promise<{ ok: true, actual: string } | { ok: false, actual: string, expected: string }>}
 */
export async function verifySha256(filePath, expectedSha256) {
  const expected = String(expectedSha256).trim().toLowerCase();
  const actual = (await sha256File(filePath)).toLowerCase();
  if (actual !== expected) {
    return { ok: false, actual, expected };
  }
  return { ok: true, actual };
}

/**
 * @param {string} filePath
 * @param {string} expectedSha256
 */
export async function assertSha256(filePath, expectedSha256) {
  const result = await verifySha256(filePath, expectedSha256);
  if (!result.ok) {
    const err = new Error(
      `SHA-256 mismatch for ${filePath}: expected ${result.expected}, got ${result.actual}`,
    );
    err.code = 'CHECKSUM_MISMATCH';
    err.actual = result.actual;
    err.expected = result.expected;
    throw err;
  }
  return result.actual;
}

/** Convenience for small buffers already in memory. */
export async function sha256FileOrBuffer(pathOrBuf) {
  if (Buffer.isBuffer(pathOrBuf) || typeof pathOrBuf === 'string') {
    if (typeof pathOrBuf === 'string' && !pathOrBuf.includes('\n') && pathOrBuf.length < 4096) {
      try {
        const buf = await readFile(pathOrBuf);
        return sha256Hex(buf);
      } catch {
        return sha256Hex(pathOrBuf);
      }
    }
    return sha256Hex(pathOrBuf);
  }
  throw new TypeError('unsupported input');
}
