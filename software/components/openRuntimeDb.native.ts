import * as SQLite from 'expo-sqlite';
import { wrapExpoSqlite, type SqlExecutor } from '@/modules/app-core/user-data';

/** Native/Expo runtime: use the device-persisted SQLite database. */
export async function openRuntimeDb(): Promise<{
  db: SqlExecutor;
  persistSqlJs: boolean;
}> {
  return {
    db: wrapExpoSqlite(
      SQLite.openDatabaseSync('UserData.sqlite') as unknown as Parameters<
        typeof wrapExpoSqlite
      >[0],
    ),
    persistSqlJs: false,
  };
}
