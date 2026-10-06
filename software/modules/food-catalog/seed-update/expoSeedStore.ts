import type { SeedStore, StagedSeed } from './types';

export type ExpoFileSystem = {
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
 * Unwired Expo adapter sketch. Staged bytes and the active pointer are written
 * to temporary paths first, then moved into place. Replacing the fixed pointer
 * path makes activation independent of the device wall clock.
 */
export function createExpoFileSystemSeedStore(
  rootDirectory?: string,
  fileSystemOverride?: ExpoFileSystem,
): SeedStore {
  // Kept behind require so Expo FileSystem types/native code are not required by tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = fileSystemOverride ?? (require('expo-file-system') as ExpoFileSystem);
  const root = rootDirectory ?? `${fileSystem.documentDirectory ?? ''}food-seeds`;
  let sequence = 0;
  const activePointerName = 'active.json';

  const ensureRoot = () => fileSystem.makeDirectoryAsync(root, { intermediates: true });
  const pathFor = (name: string) => `${root}/${name}`;

  async function readActivePointer(): Promise<string | null> {
    await ensureRoot();
    if (!(await fileSystem.readDirectoryAsync(root)).includes(activePointerName)) return null;
    const marker = JSON.parse(await fileSystem.readAsStringAsync(pathFor(activePointerName))) as {
      id?: unknown;
    };
    if (typeof marker.id !== 'string') throw new Error('invalid active seed marker');
    return marker.id;
  }

  return {
    async stageBytes(bytes, seedVersion) {
      await ensureRoot();
      const id = `seed-${Date.now()}-${sequence++}.sqlite.zst`;
      const temporary = pathFor(`${id}.tmp`);
      const final = pathFor(id);
      try {
        await fileSystem.writeAsStringAsync(temporary, toBase64(bytes), {
          encoding: fileSystem.EncodingType?.Base64 ?? 'base64',
        });
        await fileSystem.moveAsync({ from: temporary, to: final });
      } catch (error) {
        await Promise.all([
          fileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined),
          fileSystem.deleteAsync(final, { idempotent: true }).catch(() => undefined),
        ]);
        throw error;
      }
      return { id, seedVersion };
    },
    readActivePointer,
    async atomicSwapActivePointer(staged, expectedPrevious) {
      if ((await readActivePointer()) !== expectedPrevious) throw new Error('active seed changed');
      const temporary = pathFor(`active-${Date.now()}-${sequence++}.tmp`);
      try {
        await fileSystem.writeAsStringAsync(temporary, JSON.stringify(staged));
        await fileSystem.moveAsync({ from: temporary, to: pathFor(activePointerName) });
      } catch (error) {
        await fileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
        throw error;
      }
    },
    async deleteStaged(staged) {
      if ((await readActivePointer()) === staged.id) return;
      await fileSystem.deleteAsync(pathFor(staged.id), { idempotent: true });
    },
  };
}
