import type { SeedStore, StagedSeed } from './types';

type ExpoFileSystem = {
  documentDirectory?: string | null;
  EncodingType?: { Base64?: string };
  makeDirectoryAsync(path: string, options?: { intermediates?: boolean }): Promise<void>;
  writeAsStringAsync(path: string, contents: string, options?: { encoding?: string }): Promise<void>;
  readAsStringAsync(path: string): Promise<string>;
  readDirectoryAsync(path: string): Promise<string[]>;
  moveAsync(options: { from: string; to: string }): Promise<void>;
  deleteAsync(path: string, options?: { idempotent?: boolean }): Promise<void>;
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  if (typeof btoa !== 'function') throw new Error('base64 encoder unavailable');
  return btoa(binary);
}

/**
 * Unwired Expo adapter sketch. It uses append-only activation marker files:
 * renaming a complete temporary marker to a unique final name is the atomic
 * pointer swap, while older markers and seed files remain available.
 */
export function createExpoFileSystemSeedStore(rootDirectory?: string): SeedStore {
  // Kept behind require so Expo FileSystem types/native code are not required by tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = require('expo-file-system') as ExpoFileSystem;
  const root = rootDirectory ?? `${fileSystem.documentDirectory ?? ''}food-seeds`;
  let sequence = 0;

  const ensureRoot = () => fileSystem.makeDirectoryAsync(root, { intermediates: true });
  const pathFor = (name: string) => `${root}/${name}`;

  async function readActivePointer(): Promise<string | null> {
    await ensureRoot();
    const markers = (await fileSystem.readDirectoryAsync(root))
      .filter((name) => /^active-\d{13}-\d+\.json$/.test(name))
      .sort();
    if (markers.length === 0) return null;
    const marker = JSON.parse(await fileSystem.readAsStringAsync(pathFor(markers.at(-1)!))) as {
      id?: unknown;
    };
    if (typeof marker.id !== 'string') throw new Error('invalid active seed marker');
    return marker.id;
  }

  return {
    async stageBytes(bytes, seedVersion) {
      await ensureRoot();
      const id = `seed-${Date.now()}-${sequence++}.sqlite.zst`;
      await fileSystem.writeAsStringAsync(pathFor(id), toBase64(bytes), {
        encoding: fileSystem.EncodingType?.Base64 ?? 'base64',
      });
      return { id, seedVersion };
    },
    readActivePointer,
    async atomicSwapActivePointer(staged, expectedPrevious) {
      if ((await readActivePointer()) !== expectedPrevious) throw new Error('active seed changed');
      const order = `${Date.now()}`.padStart(13, '0');
      const suffix = sequence++;
      const temporary = pathFor(`pointer-${order}-${suffix}.tmp`);
      const final = pathFor(`active-${order}-${suffix}.json`);
      await fileSystem.writeAsStringAsync(temporary, JSON.stringify(staged));
      await fileSystem.moveAsync({ from: temporary, to: final });
    },
    async deleteStaged(staged) {
      if ((await readActivePointer()) === staged.id) return;
      await fileSystem.deleteAsync(pathFor(staged.id), { idempotent: true });
    },
  };
}
