import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type UserDataContextValue = {
  ready: boolean;
  error: string | null;
  db: SqlExecutor | null;
  snapshot: OnboardingSnapshot | null;
  refresh: () => void;
};

const UserDataContext = createContext<UserDataContextValue | null>(null);

async function openRuntimeDb(): Promise<SqlExecutor> {
  try {
    // Native / Expo Go path
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
      return wrapExpoSqlite(raw);
    }
  } catch {
    // fall through to sql.js (web / Node / limited runtimes)
  }
  return openSqlJsDatabase();
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SqlExecutor | null>(null);
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openRuntimeDb();
        migrateUserStore(opened);
        if (cancelled) {
          opened.close();
          return;
        }
        setDb(opened);
        setSnapshot(loadOnboardingSnapshot(opened));
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
