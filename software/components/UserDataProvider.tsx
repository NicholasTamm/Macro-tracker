import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  migrateUserStore,
  openSqlJsDatabase,
  loadOnboardingSnapshot,
  type OnboardingSnapshot,
  type SqlExecutor,
  wrapExpoSqlite,
} from '@/modules/app-core/user-data';

const SQLJS_STORAGE_KEY = 'macro-tracker:UserData.sqljs.b64';

type UserDataContextValue = {
  ready: boolean;
  error: string | null;
  db: SqlExecutor | null;
  snapshot: OnboardingSnapshot | null;
  refresh: () => void;
};

const UserDataContext = createContext<UserDataContextValue | null>(null);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa is available in browsers / RN web; Buffer for Node if ever used here.
  if (typeof btoa === 'function') return btoa(binary);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function readPersistedSqlJs(): Uint8Array | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const b64 = localStorage.getItem(SQLJS_STORAGE_KEY);
    if (!b64) return undefined;
    return base64ToBytes(b64);
  } catch {
    return undefined;
  }
}

function writePersistedSqlJs(db: SqlExecutor): void {
  if (!db.exportBytes) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const bytes = db.exportBytes();
    localStorage.setItem(SQLJS_STORAGE_KEY, bytesToBase64(bytes));
  } catch {
    // ignore quota / private mode
  }
}

async function openRuntimeDb(): Promise<{ db: SqlExecutor; persistSqlJs: boolean }> {
  try {
    // Native / Expo Go path — expo-sqlite persists on device.
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
    if (typeof SQLite.openDatabaseSync === 'function') {
      const raw = SQLite.openDatabaseSync('UserData.sqlite');
      return { db: wrapExpoSqlite(raw), persistSqlJs: false };
    }
  } catch {
    // fall through to sql.js (web / Node / limited runtimes)
  }
  const bytes = readPersistedSqlJs();
  const db = await openSqlJsDatabase(bytes);
  return { db, persistSqlJs: true };
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SqlExecutor | null>(null);
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persistSqlJsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openRuntimeDb();
        migrateUserStore(opened.db);
        if (cancelled) {
          opened.db.close();
          return;
        }
        persistSqlJsRef.current = opened.persistSqlJs;
        if (opened.persistSqlJs) writePersistedSqlJs(opened.db);
        setDb(opened.db);
        setSnapshot(loadOnboardingSnapshot(opened.db));
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
    };
  }, []);

  const refresh = useCallback(() => {
    if (!db) return;
    setSnapshot(loadOnboardingSnapshot(db));
    if (persistSqlJsRef.current) writePersistedSqlJs(db);
  }, [db]);

  const value = useMemo(
    () => ({ ready, error, db, snapshot, refresh }),
    [ready, error, db, snapshot, refresh],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider');
  return ctx;
}
