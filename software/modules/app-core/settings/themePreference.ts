import type { SqlExecutor } from '../user-data';

export type ThemePreference = 'system' | 'light' | 'dark';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
export const THEME_SETTING_KEY = 'theme_preference';

type StartupThemeDatabase = {
  getFirstSync: <T>(sql: string, params?: unknown[]) => T | null;
  closeSync: () => void;
};

type OpenStartupThemeDatabase = (name: string) => StartupThemeDatabase;

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_THEME_PREFERENCE;
}

export function getThemePreference(db: SqlExecutor): ThemePreference {
  const row = db.get<{ value: string }>(
    'SELECT value FROM app_setting WHERE key = ?',
    [THEME_SETTING_KEY],
  );
  return parseThemePreference(row?.value);
}

export function readStartupThemePreference(
  openDatabaseSync: OpenStartupThemeDatabase,
): ThemePreference {
  let db: StartupThemeDatabase | null = null;
  try {
    db = openDatabaseSync('UserData.sqlite');
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM app_setting WHERE key = ?',
      [THEME_SETTING_KEY],
    );
    return parseThemePreference(row?.value);
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  } finally {
    db?.closeSync();
  }
}

export function initializeNativeThemePreference(
  openDatabaseSync: OpenStartupThemeDatabase,
  applyPreference: (preference: ThemePreference) => void,
): ThemePreference {
  const preference = readStartupThemePreference(openDatabaseSync);
  applyPreference(preference);
  return preference;
}

export function saveThemePreference(
  db: SqlExecutor,
  preference: ThemePreference,
): ThemePreference {
  const value = parseThemePreference(preference);
  db.run(
    `INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [THEME_SETTING_KEY, value, new Date().toISOString()],
  );
  return value;
}
