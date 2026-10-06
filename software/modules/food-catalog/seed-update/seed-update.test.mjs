import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  createHash,
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(here, '../../..');
const bundleDir = join(here, '.bundle');
mkdirSync(bundleDir, { recursive: true });
writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
execFileSync(
  join(softwareRoot, 'node_modules/esbuild/bin/esbuild'),
  [
    join(here, 'index.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--external:expo-file-system',
    `--outfile=${join(bundleDir, 'seed-update.js')}`,
  ],
  { cwd: softwareRoot, stdio: 'pipe' },
);

const {
  createExpoFileSystemSeedStore,
  InMemorySeedStore,
  PINNED_SEED_PUBLIC_KEYS,
  runSeedUpdate,
} = await import(
  pathToFileURL(join(bundleDir, 'seed-update.js')).href
);

const keyId = 'test-key';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function signedManifest(bytes, overrides = {}) {
  const sha256 = overrides.sha256 ?? digest(bytes);
  return {
    manifestVersion: 1,
    catalogSchemaVersion: 1,
    seedVersion: 'fixture.2',
    minimumAppBuild: 10,
    artifact: {
      url: 'https://cdn.example.test/FoodSeed.sqlite.zst',
      compression: 'zstd',
      compressedBytes: bytes.byteLength,
      uncompressedBytes: bytes.byteLength * 3,
      sha256,
      signature: sign(null, Buffer.from(sha256, 'utf8'), privateKey).toString('base64'),
      signingKeyID: keyId,
      ...overrides.artifact,
    },
    uncompressedSha256: 'a'.repeat(64),
    sources: [],
    ...overrides,
  };
}

function fixture(overrides = {}) {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const store = overrides.store ?? new InMemorySeedStore({
    id: 'previous',
    seedVersion: 'fixture.1',
    bytes: new Uint8Array([9]),
  });
  const manifest = overrides.manifest ?? signedManifest(bytes);
  let manifestFetches = 0;
  let artifactFetches = 0;
  const deps = {
    fetchManifest: async () => {
      manifestFetches += 1;
      if (overrides.fetchManifestError) throw new Error('offline');
      return manifest;
    },
    fetchArtifact: async () => {
      artifactFetches += 1;
      if (overrides.fetchArtifactError) throw new Error('offline');
      return overrides.artifactBytes ?? bytes;
    },
    sha256Hex: (value) => digest(value),
    verifyEd25519: (message, signatureB64, requestedKeyId) => {
      const pem = { [keyId]: publicPem }[requestedKeyId];
      if (!pem) return false;
      return verify(null, Buffer.from(message, 'utf8'), createPublicKey(pem), Buffer.from(signatureB64, 'base64'));
    },
    pinnedPublicKeys: { [keyId]: publicPem },
    freeBytes: () => 20 * 1024 * 1024,
    seedStore: store,
    ...overrides.deps,
  };
  return {
    bytes,
    store,
    deps,
    calls: () => ({ manifestFetches, artifactFetches }),
    options: {
      currentSeedVersion: 'fixture.1',
      appBuild: 10,
      supportedCatalogSchemaVersions: [1],
      flagEnabled: true,
      ...overrides.options,
    },
  };
}

test('valid signed artifact activates and retains the previous seed', async () => {
  const f = fixture();
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), {
    status: 'activated',
    seedVersion: 'fixture.2',
  });
  const active = await f.store.readActivePointer();
  assert.notEqual(active, 'previous');
  assert.deepEqual(f.store.bytesFor(active), f.bytes);
  assert.equal(f.store.hasSeed('previous'), true);
});

test('not-newer manifest is up to date without fetching the artifact', async () => {
  const f = fixture({ options: { currentSeedVersion: 'fixture.10' } });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'up-to-date' });
  assert.equal(f.calls().artifactFetches, 0);
});

test('corrupt signature is rejected', async () => {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const manifest = signedManifest(bytes);
  manifest.artifact.signature = `${manifest.artifact.signature.slice(0, -2)}AA`;
  const f = fixture({ manifest });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'rejected', reason: 'signature' });
});

test('artifact hash mismatch is rejected before signature verification', async () => {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const f = fixture({ manifest: signedManifest(bytes, { sha256: 'b'.repeat(64) }) });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'rejected', reason: 'hash' });
});

test('unsupported schema is rejected', async () => {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const f = fixture({ manifest: signedManifest(bytes, { catalogSchemaVersion: 2 }) });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'rejected', reason: 'schema' });
});

test('unsupported manifest version is rejected before artifact download', async () => {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const f = fixture({ manifest: signedManifest(bytes, { manifestVersion: 2 }) });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), {
    status: 'rejected', reason: 'manifest-invalid',
  });
  assert.equal(f.calls().artifactFetches, 0);
});

test('minimum app build is enforced', async () => {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const f = fixture({ manifest: signedManifest(bytes, { minimumAppBuild: 11 }) });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'rejected', reason: 'min-app-build' });
});

test('compressed plus uncompressed size and margin must fit', async () => {
  const f = fixture({ deps: { freeBytes: () => 1024 } });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'rejected', reason: 'low-space' });
  assert.equal(f.calls().artifactFetches, 0);
});

test('unknown signing key is rejected before download', async () => {
  const bytes = new Uint8Array([1, 3, 3, 7]);
  const manifest = signedManifest(bytes);
  manifest.artifact.signingKeyID = 'untrusted-key';
  const f = fixture({ manifest });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'rejected', reason: 'unknown-key' });
  assert.equal(f.calls().artifactFetches, 0);
});

test('disabled flag is checked before either fetch port', async () => {
  const f = fixture({ options: { flagEnabled: false } });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), { status: 'disabled' });
  assert.deepEqual(f.calls(), { manifestFetches: 0, artifactFetches: 0 });
});

test('activation failure keeps prior pointer and cleans staged bytes', async () => {
  const store = new InMemorySeedStore({
    id: 'previous',
    seedVersion: 'fixture.1',
    bytes: new Uint8Array([9]),
  });
  store.failActivation = true;
  const f = fixture({ store });
  assert.deepEqual(await runSeedUpdate(f.deps, f.options), {
    status: 'rejected',
    reason: 'activation-failed',
  });
  assert.equal(await store.readActivePointer(), 'previous');
  assert.equal(store.hasSeed('previous'), true);
  assert.equal(store.stagedCount(), 0);
});

test('invalid manifest, fetch error, and size mismatch are typed rejections', async () => {
  const invalid = fixture({ manifest: { manifestVersion: 1 } });
  assert.deepEqual(await runSeedUpdate(invalid.deps, invalid.options), {
    status: 'rejected', reason: 'manifest-invalid',
  });
  const failed = fixture({ fetchArtifactError: true });
  assert.deepEqual(await runSeedUpdate(failed.deps, failed.options), {
    status: 'rejected', reason: 'fetch-failed',
  });
  const wrongSize = fixture({ artifactBytes: new Uint8Array([1]) });
  assert.deepEqual(await runSeedUpdate(wrongSize.deps, wrongSize.options), {
    status: 'rejected', reason: 'size-mismatch',
  });
});

function fakeExpoFileSystem() {
  const files = new Map();
  let failNextWrite = false;
  let failNextMove = false;
  let deleteDestinationBeforeMoveFailure = false;
  return {
    files,
    failWriteAfterCreatingFile() {
      failNextWrite = true;
    },
    failMove({ afterDeletingDestination = false } = {}) {
      failNextMove = true;
      deleteDestinationBeforeMoveFailure = afterDeletingDestination;
    },
    api: {
      EncodingType: { Base64: 'base64' },
      async makeDirectoryAsync() {},
      async writeAsStringAsync(path, contents) {
        files.set(path, contents);
        if (failNextWrite) {
          failNextWrite = false;
          throw new Error('interrupted write');
        }
      },
      async readAsStringAsync(path) {
        if (!files.has(path)) throw new Error('file not found');
        return files.get(path);
      },
      async readDirectoryAsync(path) {
        const prefix = `${path}/`;
        return [...files.keys()]
          .filter((file) => file.startsWith(prefix))
          .map((file) => file.slice(prefix.length))
          .filter((file) => !file.includes('/'));
      },
      async moveAsync({ from, to }) {
        if (failNextMove) {
          failNextMove = false;
          if (deleteDestinationBeforeMoveFailure) files.delete(to);
          deleteDestinationBeforeMoveFailure = false;
          throw new Error('interrupted move');
        }
        if (!files.has(from)) throw new Error('file not found');
        files.set(to, files.get(from));
        files.delete(from);
      },
      async deleteAsync(path) {
        files.delete(path);
      },
    },
  };
}

test('Expo adapter removes partial temporary seed when staging fails', async () => {
  const fileSystem = fakeExpoFileSystem();
  fileSystem.failWriteAfterCreatingFile();
  const store = createExpoFileSystemSeedStore('/seed-root', fileSystem.api);

  await assert.rejects(store.stageBytes(new Uint8Array([1, 2, 3]), 'fixture.2'));
  assert.deepEqual([...fileSystem.files.keys()], []);
});

test('Expo adapter fixed pointer activates the newest seed when the clock moves backward', async () => {
  const fileSystem = fakeExpoFileSystem();
  const store = createExpoFileSystemSeedStore('/seed-root', fileSystem.api);
  const originalNow = Date.now;
  try {
    Date.now = () => 2_000;
    const first = await store.stageBytes(new Uint8Array([1]), 'fixture.2');
    await store.atomicSwapActivePointer(first, null);

    Date.now = () => 1_000;
    const second = await store.stageBytes(new Uint8Array([2]), 'fixture.3');
    await store.atomicSwapActivePointer(second, first.id);

    assert.equal(await store.readActivePointer(), second.id);
    assert.equal(fileSystem.files.has('/seed-root/active.json'), true);
  } finally {
    Date.now = originalNow;
  }
});

test('Expo adapter preserves the prior pointer when iOS deletes the destination before move fails', async () => {
  const fileSystem = fakeExpoFileSystem();
  const store = createExpoFileSystemSeedStore('/seed-root', fileSystem.api);
  const first = await store.stageBytes(new Uint8Array([1]), 'fixture.2');
  await store.atomicSwapActivePointer(first, null);
  const second = await store.stageBytes(new Uint8Array([2]), 'fixture.3');
  fileSystem.failMove({ afterDeletingDestination: true });

  await assert.rejects(store.atomicSwapActivePointer(second, first.id));
  assert.equal(await store.readActivePointer(), first.id);
  assert.equal([...fileSystem.files.keys()].some((path) => path.endsWith('.tmp')), false);

  const restartedStore = createExpoFileSystemSeedStore('/seed-root', fileSystem.api);
  fileSystem.failMove({ afterDeletingDestination: true });
  await assert.rejects(restartedStore.atomicSwapActivePointer(second, first.id));
  assert.equal(await restartedStore.readActivePointer(), first.id);
});

test('Expo adapter serializes concurrent compare-and-swap operations', async () => {
  const fileSystem = fakeExpoFileSystem();
  const store = createExpoFileSystemSeedStore('/seed-root', fileSystem.api);
  const first = await store.stageBytes(new Uint8Array([1]), 'fixture.1');
  await store.atomicSwapActivePointer(first, null);
  const second = await store.stageBytes(new Uint8Array([2]), 'fixture.2');
  const third = await store.stageBytes(new Uint8Array([3]), 'fixture.3');

  const results = await Promise.allSettled([
    store.atomicSwapActivePointer(second, first.id),
    store.atomicSwapActivePointer(third, first.id),
  ]);

  assert.deepEqual(results.map(({ status }) => status), ['fulfilled', 'rejected']);
  assert.equal(await store.readActivePointer(), second.id);
});

test('committed signing key verifies the fixture signature or dev-key roundtrip', () => {
  const assetDir = join(softwareRoot, 'modules/food-catalog/assets');
  const keyDir = join(softwareRoot, 'modules/food-catalog/scripts/build-seed/keys');
  const manifest = JSON.parse(readFileSync(join(assetDir, 'seed-manifest.fixture.json'), 'utf8'));
  const publicKey = createPublicKey(readFileSync(join(keyDir, 'food-seed-2026-01.pub'), 'utf8'));
  assert.equal(
    verify(
      null,
      Buffer.from(manifest.artifact.sha256, 'utf8'),
      publicKey,
      Buffer.from(manifest.artifact.signature, 'base64'),
    ),
    true,
  );
  assert.equal(PINNED_SEED_PUBLIC_KEYS[manifest.artifact.signingKeyID].trim(), readFileSync(join(keyDir, 'food-seed-2026-01.pub'), 'utf8').trim());

  const artifactPath = join(assetDir, 'FoodSeed.fixture.sqlite.zst');
  if (existsSync(artifactPath)) {
    assert.equal(digest(readFileSync(artifactPath)), manifest.artifact.sha256);
  } else {
    const devKey = createPrivateKey(readFileSync(join(keyDir, 'food-seed-2026-01.dev.pkcs8'), 'utf8'));
    const message = digest(readFileSync(join(assetDir, 'FoodSeed.fixture.sqlite')));
    const signature = sign(null, Buffer.from(message, 'utf8'), devKey);
    assert.equal(verify(null, Buffer.from(message, 'utf8'), publicKey, signature), true);
  }
});
