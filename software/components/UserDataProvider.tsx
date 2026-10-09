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
  type OnboardingSnapshot,
  type SqlExecutor,
} from '@/modules/app-core/user-data';
import {
  saveThemePreference,
  type ThemePreference,
} from '@/modules/app-core/settings';
import { loadUserDataProviderState } from './userDataState';
import { openRuntimeDb } from './openRuntimeDb';

const SQLJS_STORAGE_KEY = 'macro-tracker:UserData.sqljs.b64';

type UserDataContextValue = {
  ready: boolean;
  error: string | null;
  db: SqlExecutor | null;
  snapshot: OnboardingSnapshot | null;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
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
  return Buffer.from(bytes).toString('base64');
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

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SqlExecutor | null>(null);
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>('system');
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
        const state = loadUserDataProviderState(opened.db);
        setDb(opened.db);
        setSnapshot(state.snapshot);
        setThemePreferenceState(state.themePreference);
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
    const state = loadUserDataProviderState(db);
    setSnapshot(state.snapshot);
    setThemePreferenceState(state.themePreference);
    if (persistSqlJsRef.current) writePersistedSqlJs(db);
  }, [db]);

  const setThemePreference = useCallback(
    (preference: ThemePreference) => {
      if (!db) return;
      const saved = saveThemePreference(db, preference);
      setThemePreferenceState(saved);
      if (persistSqlJsRef.current) writePersistedSqlJs(db);
    },
    [db],
  );

  const value = useMemo(
    () => ({ ready, error, db, snapshot, themePreference, setThemePreference, refresh }),
    [ready, error, db, snapshot, themePreference, setThemePreference, refresh],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider');
  return ctx;
}
