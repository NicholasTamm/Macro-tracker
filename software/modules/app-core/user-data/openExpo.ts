/**
 * Expo runtime adapter (device / Expo Go / dev client).
 * Not exercised on Linux CI — use openSqlJsDatabase for Node tests.
 *
 * Usage (app code):
 *   import * as SQLite from 'expo-sqlite';
 *   import { wrapExpoSqlite } from '@/modules/app-core/user-data';
 *   const db = wrapExpoSqlite(SQLite.openDatabaseSync('UserData.sqlite'));
 *   migrateUserStore(db, USER_STORE_SCHEMA_SQL);
 */
import type { SqlExecutor, SqlRow } from './sqlExecutor';

type ExpoDb = {
  execSync: (sql: string) => void;
  runSync: (sql: string, params?: unknown[]) => void;
  getFirstSync: <T>(sql: string, params?: unknown[]) => T | null;
  getAllSync: <T>(sql: string, params?: unknown[]) => T[];
  closeSync?: () => void;
};

export function wrapExpoSqlite(db: ExpoDb): SqlExecutor {
  return {
    exec(sql: string) {
      db.execSync(sql);
    },
    run(sql: string, params: unknown[] = []) {
      db.runSync(sql, params);
    },
    get<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      return (db.getFirstSync<T>(sql, params) ?? undefined) as T | undefined;
    },
    all<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      return db.getAllSync<T>(sql, params);
    },
    close() {
      db.closeSync?.();
    },
  };
}
