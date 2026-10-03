import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, '../keys');

export const DEFAULT_SIGNING_KEY_ID = 'food-seed-2026-01';

/**
 * Load PKCS8 private key PEM (or PKCS8 file contents).
 * @param {string} [keyPath]
 */
export async function loadPrivateKey(keyPath) {
  const path =
    keyPath ||
    process.env.FOOD_SEED_SIGNING_KEY ||
    join(KEYS_DIR, `${DEFAULT_SIGNING_KEY_ID}.dev.pkcs8`);
  const pem = await readFile(path, 'utf8');
  return { key: createPrivateKey(pem), path, keyId: process.env.FOOD_SEED_SIGNING_KEY_ID || DEFAULT_SIGNING_KEY_ID };
}

/**
 * @param {string} [pubPath]
 */
export async function loadPublicKey(pubPath) {
  const path = pubPath || join(KEYS_DIR, `${DEFAULT_SIGNING_KEY_ID}.pub`);
  const pem = await readFile(path, 'utf8');
  return { key: createPublicKey(pem), path };
}

/**
 * Sign the SHA-256 hex digest (utf8) of an artifact with Ed25519.
 * Returns base64 signature.
 * @param {string} sha256Hex
 * @param {import('node:crypto').KeyObject} privateKey
 */
export function signSha256Hex(sha256Hex, privateKey) {
  const hex = String(sha256Hex).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`signSha256Hex: expected 64-hex digest, got ${hex.slice(0, 16)}…`);
  }
  const sig = sign(null, Buffer.from(hex, 'utf8'), privateKey);
  return sig.toString('base64');
}

/**
 * @param {string} sha256Hex
 * @param {string} signatureB64
 * @param {import('node:crypto').KeyObject} publicKey
 */
export function verifySha256HexSignature(sha256Hex, signatureB64, publicKey) {
  const hex = String(sha256Hex).trim().toLowerCase();
  const sig = Buffer.from(signatureB64, 'base64');
  return verify(null, Buffer.from(hex, 'utf8'), publicKey, sig);
}
