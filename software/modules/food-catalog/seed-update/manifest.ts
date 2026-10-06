import type { SeedUpdateManifest } from './types';

const SHA256_HEX = /^[0-9a-f]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

export function parseSeedManifest(value: unknown): SeedUpdateManifest | null {
  if (!isRecord(value) || !isRecord(value.artifact)) return null;
  const artifact = value.artifact;

  if (
    !isPositiveInteger(value.manifestVersion) ||
    !isPositiveInteger(value.catalogSchemaVersion) ||
    typeof value.seedVersion !== 'string' ||
    value.seedVersion.trim().length === 0 ||
    !isPositiveInteger(value.minimumAppBuild) ||
    typeof artifact.url !== 'string' ||
    artifact.url.length === 0 ||
    typeof artifact.compression !== 'string' ||
    artifact.compression.length === 0 ||
    !isPositiveInteger(artifact.compressedBytes) ||
    !isPositiveInteger(artifact.uncompressedBytes) ||
    typeof artifact.sha256 !== 'string' ||
    !SHA256_HEX.test(artifact.sha256) ||
    typeof artifact.signature !== 'string' ||
    artifact.signature.length === 0 ||
    !BASE64.test(artifact.signature) ||
    typeof artifact.signingKeyID !== 'string' ||
    artifact.signingKeyID.length === 0 ||
    typeof value.uncompressedSha256 !== 'string' ||
    !SHA256_HEX.test(value.uncompressedSha256) ||
    !Array.isArray(value.sources)
  ) {
    return null;
  }

  return value as SeedUpdateManifest;
}

function versionParts(version: string): (number | string)[] {
  return (version.toLowerCase().match(/[0-9]+|[a-z]+/g) ?? []).map((part) =>
    /^\d+$/.test(part) ? Number(part) : part,
  );
}

/** Natural ordering for date-, semver-, and named seed versions. */
export function compareSeedVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index];
    const bv = b[index];
    if (av === bv) continue;
    if (av === undefined) {
      return b.slice(index).every((part) => typeof part === 'number' && part === 0) ? 0 : -1;
    }
    if (bv === undefined) {
      return a.slice(index).every((part) => typeof part === 'number' && part === 0) ? 0 : 1;
    }
    if (typeof av === 'number' && typeof bv === 'number') return av < bv ? -1 : 1;
    if (typeof av === 'number') return 1;
    if (typeof bv === 'number') return -1;
    return av < bv ? -1 : 1;
  }
  return 0;
}
