import { compareSeedVersions, parseSeedManifest } from './manifest';
import type { SeedUpdateDeps, SeedUpdateOptions, SeedUpdateResult } from './types';

export const SEED_UPDATE_ENABLED = false;
export const SEED_UPDATE_SPACE_MARGIN_BYTES = 1024 * 1024;

const rejected = (reason: Extract<SeedUpdateResult, { status: 'rejected' }>['reason']) =>
  ({ status: 'rejected', reason }) as const;

export async function runSeedUpdate(
  deps: SeedUpdateDeps,
  options: SeedUpdateOptions,
): Promise<SeedUpdateResult> {
  if (!options.flagEnabled) return { status: 'disabled' };

  let rawManifest: unknown;
  try {
    rawManifest = await deps.fetchManifest();
  } catch {
    return rejected('fetch-failed');
  }

  const manifest = parseSeedManifest(rawManifest);
  if (!manifest) return rejected('manifest-invalid');

  if (compareSeedVersions(manifest.seedVersion, options.currentSeedVersion) <= 0) {
    return { status: 'up-to-date' };
  }
  if (!options.supportedCatalogSchemaVersions.includes(manifest.catalogSchemaVersion)) {
    return rejected('schema');
  }
  if (manifest.minimumAppBuild > options.appBuild) return rejected('min-app-build');
  if (!Object.prototype.hasOwnProperty.call(deps.pinnedPublicKeys, manifest.artifact.signingKeyID)) {
    return rejected('unknown-key');
  }

  const requiredBytes =
    manifest.artifact.compressedBytes +
    manifest.artifact.uncompressedBytes +
    SEED_UPDATE_SPACE_MARGIN_BYTES;
  try {
    const availableBytes = await deps.freeBytes();
    if (!Number.isFinite(availableBytes) || availableBytes < requiredBytes) {
      return rejected('low-space');
    }
  } catch {
    return rejected('low-space');
  }

  let artifact: Uint8Array;
  try {
    artifact = await deps.fetchArtifact(manifest.artifact.url);
  } catch {
    return rejected('fetch-failed');
  }
  if (!(artifact instanceof Uint8Array) || artifact.byteLength !== manifest.artifact.compressedBytes) {
    return rejected('size-mismatch');
  }

  let digest: string;
  try {
    digest = (await deps.sha256Hex(artifact)).toLowerCase();
  } catch {
    return rejected('hash');
  }
  if (digest !== manifest.artifact.sha256) return rejected('hash');

  try {
    const valid = await deps.verifyEd25519(
      manifest.artifact.sha256,
      manifest.artifact.signature,
      manifest.artifact.signingKeyID,
    );
    if (!valid) return rejected('signature');
  } catch {
    return rejected('signature');
  }

  let previous: string | null;
  try {
    previous = await deps.seedStore.readActivePointer();
  } catch {
    return rejected('activation-failed');
  }

  let staged;
  try {
    staged = await deps.seedStore.stageBytes(artifact, manifest.seedVersion);
  } catch {
    return rejected('activation-failed');
  }

  try {
    await deps.seedStore.atomicSwapActivePointer(staged, previous);
    return { status: 'activated', seedVersion: manifest.seedVersion };
  } catch {
    try {
      await deps.seedStore.deleteStaged(staged);
    } catch {
      // Preserve the activation failure result; the active pointer is unchanged
      // by the SeedStore atomic-swap contract.
    }
    return rejected('activation-failed');
  }
}
