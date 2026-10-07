export type SeedUpdateManifest = {
  manifestVersion: number;
  catalogSchemaVersion: number;
  seedVersion: string;
  minimumAppBuild: number;
  artifact: {
    url: string;
    compression: string;
    compressedBytes: number;
    uncompressedBytes: number;
    sha256: string;
    signature: string;
    signingKeyID: string;
  };
  uncompressedSha256: string;
  sources: unknown[];
};

export type StagedSeed = {
  id: string;
  seedVersion: string;
};

/**
 * Storage boundary for downloaded seeds.
 *
 * `atomicSwapActivePointer` is a compare-and-swap: on rejection or throw it
 * MUST leave the active pointer equal to `expectedPrevious`. Successful swaps
 * retain the previous seed so a later app-start rollback remains possible.
 */
export interface SeedStore {
  stageBytes(bytes: Uint8Array, seedVersion: string): Promise<StagedSeed>;
  readActivePointer(): Promise<string | null>;
  atomicSwapActivePointer(
    staged: StagedSeed,
    expectedPrevious: string | null,
  ): Promise<void>;
  deleteStaged(staged: StagedSeed): Promise<void>;
}

export type SeedUpdateRejectReason =
  | 'signature'
  | 'hash'
  | 'schema'
  | 'min-app-build'
  | 'low-space'
  | 'unknown-key'
  | 'manifest-invalid'
  | 'fetch-failed'
  | 'size-mismatch'
  | 'activation-failed';

export type SeedUpdateResult =
  | { status: 'disabled' }
  | { status: 'up-to-date' }
  | { status: 'activated'; seedVersion: string }
  | { status: 'rejected'; reason: SeedUpdateRejectReason };

export type SeedUpdateDeps = {
  fetchManifest(): Promise<unknown>;
  fetchArtifact(url: string): Promise<Uint8Array>;
  sha256Hex(bytes: Uint8Array): Promise<string> | string;
  verifyEd25519(
    messageUtf8: string,
    signatureB64: string,
    keyId: string,
  ): Promise<boolean> | boolean;
  /** Public keys (SPKI PEM) trusted by this app build, keyed by signingKeyID. */
  pinnedPublicKeys: Readonly<Record<string, string>>;
  freeBytes(): Promise<number> | number;
  seedStore: SeedStore;
};

export type SeedUpdateOptions = {
  currentSeedVersion: string;
  appBuild: number;
  supportedCatalogSchemaVersions: readonly number[];
  flagEnabled: boolean;
};
