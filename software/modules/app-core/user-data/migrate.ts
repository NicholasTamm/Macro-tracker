import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlExecutor } from './sqlExecutor';

export const USER_STORE_SCHEMA_VERSION = '1';

/** Default path relative to `software/` cwd. */
export function userStoreSchemaPath(softwareRoot?: string): string {
  const root = softwareRoot ?? process.cwd();
  return join(root, 'modules/food-catalog/schema/user-store-v1.sql');
}

export function loadUserStoreSchemaSql(schemaPath?: string): string {
  return readFileSync(schemaPath ?? userStoreSchemaPath(), 'utf8');
}

export type MigrateResult = {
  applied: boolean;
  version: string;
};

/**
 * Apply user-store-v1.sql when schema_meta.user_store_version is missing.
 */
export function migrateUserStore(db: SqlExecutor, schemaSql?: string): MigrateResult {
  const sql = schemaSql ?? loadUserStoreSchemaSql();
  db.exec('PRAGMA foreign_keys = ON;');

  const table = db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'",
  );
  if (!table) {
    db.exec(sql);
    // DDL may already insert nothing into schema_meta — set version
    db.run(
      "INSERT INTO schema_meta(key, value) VALUES ('user_store_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [USER_STORE_SCHEMA_VERSION],
    );
    return { applied: true, version: USER_STORE_SCHEMA_VERSION };
  }

  const row = db.get<{ value: string }>(
    "SELECT value FROM schema_meta WHERE key = 'user_store_version'",
  );
  if (!row) {
    db.run("INSERT INTO schema_meta(key, value) VALUES ('user_store_version', ?)", [
      USER_STORE_SCHEMA_VERSION,
    ]);
    return { applied: true, version: USER_STORE_SCHEMA_VERSION };
  }
  if (row.value !== USER_STORE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported user store schema version ${row.value}; expected ${USER_STORE_SCHEMA_VERSION}`,
    );
  }
  return { applied: false, version: row.value };
}
