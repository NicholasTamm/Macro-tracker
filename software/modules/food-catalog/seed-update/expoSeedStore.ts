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

const markerLocks = new Map<string, Promise<void>>();

async function withMarkerLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const previous = markerLocks.get(root) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  markerLocks.set(root, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (markerLocks.get(root) === current) markerLocks.delete(root);
  }
}

/**
 * Unwired Expo adapter sketch. Staged bytes and the active pointer are written
 * to temporary paths first, then moved into place. A backup marker makes the
 * prior pointer readable if replacement removes active.json before failing.
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
  const backupPointerName = 'active.backup.json';

  const ensureRoot = () => fileSystem.makeDirectoryAsync(root, { intermediates: true });
  const pathFor = (name: string) => `${root}/${name}`;

  function parsePointer(contents: string): string {
    const marker = JSON.parse(contents) as { id?: unknown };
    if (typeof marker.id !== 'string') throw new Error('invalid active seed marker');
    return marker.id;
  }

  async function readPointerContentsUnlocked(): Promise<string | null> {
    await ensureRoot();
    const names = await fileSystem.readDirectoryAsync(root);
    if (names.includes(activePointerName)) {
      return fileSystem.readAsStringAsync(pathFor(activePointerName));
    }
    if (!names.includes(backupPointerName)) return null;
    const backup = JSON.parse(await fileSystem.readAsStringAsync(pathFor(backupPointerName))) as {
      previous?: unknown;
    };
    if (backup.previous === null) return null;
    if (typeof backup.previous !== 'string') throw new Error('invalid active seed backup');
    return backup.previous;
  }

  async function readActivePointerUnlocked(): Promise<string | null> {
    const contents = await readPointerContentsUnlocked();
    return contents === null ? null : parsePointer(contents);
  }

  const readActivePointer = () => withMarkerLock(root, readActivePointerUnlocked);

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
      await withMarkerLock(root, async () => {
        if ((await readActivePointerUnlocked()) !== expectedPrevious) {
          throw new Error('active seed changed');
        }
        const temporary = pathFor(`active-${Date.now()}-${sequence++}.tmp`);
        const activePath = pathFor(activePointerName);
        const backupPath = pathFor(backupPointerName);
        let backupReady = false;
        try {
          const previous = await readPointerContentsUnlocked();
          const names = await fileSystem.readDirectoryAsync(root);
          const recoveryBackupExists = !names.includes(activePointerName)
            && names.includes(backupPointerName);
          await fileSystem.writeAsStringAsync(temporary, JSON.stringify(staged));
          if (!recoveryBackupExists) {
            await fileSystem.writeAsStringAsync(backupPath, JSON.stringify({ previous }));
          }
          backupReady = true;
          await fileSystem.moveAsync({ from: temporary, to: activePath });
        } catch (error) {
          await fileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
          if (backupReady) {
            await fileSystem.deleteAsync(activePath, { idempotent: true }).catch(() => undefined);
          }
          throw error;
        }
        await fileSystem.deleteAsync(backupPath, { idempotent: true }).catch(() => undefined);
      });
    },
    async deleteStaged(staged) {
      await withMarkerLock(root, async () => {
        if ((await readActivePointerUnlocked()) === staged.id) return;
        await fileSystem.deleteAsync(pathFor(staged.id), { idempotent: true });
      });
    },
  };
}
