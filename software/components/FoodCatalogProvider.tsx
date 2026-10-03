import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LocalFoodRepository,
  openSeedBytes,
  wrapExpoSqliteSeed,
  type SeedMetadata,
} from '@/modules/food-catalog';

type FoodCatalogContextValue = {
  ready: boolean;
  error: string | null;
  repo: LocalFoodRepository | null;
  metadata: SeedMetadata | null;
};

const FoodCatalogContext = createContext<FoodCatalogContextValue | null>(null);

/**
 * Open bundled FoodSeed.fixture.sqlite for LocalFoodRepository.
 * Prefers expo-sqlite after copying the asset; falls back to sql.js bytes
 * (LIKE fallback when FTS5 is unavailable).
 */
async function loadFixtureBytes(): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Asset } = require('expo-asset') as {
    Asset: {
      fromModule: (mod: number) => {
        downloadAsync: () => Promise<unknown>;
        localUri?: string | null;
        uri?: string;
      };
    };
  };
  // Metro must include .sqlite in assetExts (see metro.config.js).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../modules/food-catalog/assets/FoodSeed.fixture.sqlite') as number;
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('FoodSeed fixture asset URI missing');
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Failed to fetch FoodSeed fixture: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function openSeedRepo(): Promise<LocalFoodRepository> {
  const bytes = await loadFixtureBytes();

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require('expo-file-system') as {
      documentDirectory?: string | null;
      writeAsStringAsync?: (
        path: string,
        data: string,
        opts: { encoding: string },
      ) => Promise<void>;
      EncodingType?: { Base64: string };
      getInfoAsync?: (path: string) => Promise<{ exists: boolean }>;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLite = require('expo-sqlite') as {
      openDatabaseSync?: (name: string) => {
        execSync: (sql: string) => void;
        runSync: (sql: string, params?: unknown[]) => void;
        getFirstSync: <T>(sql: string, params?: unknown[]) => T | null;
        getAllSync: <T>(sql: string, params?: unknown[]) => T[];
        closeSync?: () => void;
      };
    };

    if (
      typeof SQLite.openDatabaseSync === 'function' &&
      FileSystem.documentDirectory &&
      typeof FileSystem.writeAsStringAsync === 'function'
    ) {
      const dest = `${FileSystem.documentDirectory}FoodSeed.fixture.sqlite`;
      const info = FileSystem.getInfoAsync
        ? await FileSystem.getInfoAsync(dest)
        : { exists: false };
      if (!info.exists) {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const b64 =
          typeof btoa === 'function'
            ? btoa(binary)
            : Buffer.from(bytes).toString('base64');
        await FileSystem.writeAsStringAsync(dest, b64, {
          encoding: FileSystem.EncodingType?.Base64 ?? 'base64',
        });
      }
      const raw = SQLite.openDatabaseSync(dest);
      return new LocalFoodRepository(wrapExpoSqliteSeed(raw));
    }
  } catch {
    // fall through to sql.js
  }

  const db = await openSeedBytes(bytes);
  return new LocalFoodRepository(db);
}

export function FoodCatalogProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<LocalFoodRepository | null>(null);
  const [metadata, setMetadata] = useState<SeedMetadata | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: LocalFoodRepository | null = null;
    (async () => {
      try {
        opened = await openSeedRepo();
        if (cancelled) {
          opened.close();
          return;
        }
        setRepo(opened);
        setMetadata(opened.getMetadata());
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ ready, error, repo, metadata }),
    [ready, error, repo, metadata],
  );

  return (
    <FoodCatalogContext.Provider value={value}>{children}</FoodCatalogContext.Provider>
  );
}

export function useFoodCatalog(): FoodCatalogContextValue {
  const ctx = useContext(FoodCatalogContext);
  if (!ctx) throw new Error('useFoodCatalog must be used within FoodCatalogProvider');
  return ctx;
}
