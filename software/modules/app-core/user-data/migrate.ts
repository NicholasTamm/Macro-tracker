import type { SqlExecutor } from './sqlExecutor';
import { USER_STORE_V1_SQL } from './schemaV1';
import { USER_STORE_V2_PROFILE_SQL } from './schemaV2';
import { USER_STORE_V3_SETTINGS_SQL } from './schemaV3';

/** Current user-store schema version after M1-18 application settings. */
export const USER_STORE_SCHEMA_VERSION = '3';

export const USER_STORE_V1_VERSION = '1';
export const USER_STORE_V2_VERSION = '2';

export type MigrateResult = {
  applied: boolean;
  version: string;
  fromVersion: string | null;
};

/**
 * Apply user-store v1 (food/diary), v2 (profile), then v3 (settings) as needed.
 * Pass optional SQL overrides; defaults use bundled schema strings (no fs).
 */
export function migrateUserStore(
  db: SqlExecutor,
  schemaSql?: string,
  schemaV2Sql?: string,
  schemaV3Sql?: string,
): MigrateResult {
  const v1 = schemaSql ?? USER_STORE_V1_SQL;
  const v2 = schemaV2Sql ?? USER_STORE_V2_PROFILE_SQL;
  const v3 = schemaV3Sql ?? USER_STORE_V3_SETTINGS_SQL;
  db.exec('PRAGMA foreign_keys = ON;');

  const table = db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'",
  );

  let fromVersion: string | null = null;
  let applied = false;

  if (!table) {
    db.exec(v1);
    db.run(
      "INSERT INTO schema_meta(key, value) VALUES ('user_store_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [USER_STORE_V1_VERSION],
    );
    applied = true;
    fromVersion = null;
  }

  const row = db.get<{ value: string }>(
    "SELECT value FROM schema_meta WHERE key = 'user_store_version'",
  );
  if (!row) {
    db.run("INSERT INTO schema_meta(key, value) VALUES ('user_store_version', ?)", [
      USER_STORE_V1_VERSION,
    ]);
    applied = true;
  }

  const afterV1 = db.get<{ value: string }>(
    "SELECT value FROM schema_meta WHERE key = 'user_store_version'",
  );
  if (!afterV1) {
    throw new Error('user_store_version missing after v1 migrate');
  }

  if (afterV1.value === USER_STORE_SCHEMA_VERSION) {
    return {
      applied,
      version: USER_STORE_SCHEMA_VERSION,
      fromVersion: fromVersion ?? afterV1.value,
    };
  }

  if (afterV1.value === USER_STORE_V1_VERSION) {
    db.exec(v2);
    db.run(
      "UPDATE schema_meta SET value = ? WHERE key = 'user_store_version'",
      [USER_STORE_V2_VERSION],
    );
    applied = true;
  }

  const afterV2 = db.get<{ value: string }>(
    "SELECT value FROM schema_meta WHERE key = 'user_store_version'",
  );
  if (afterV2?.value === USER_STORE_V2_VERSION) {
    db.exec(v3);
    db.run(
      "UPDATE schema_meta SET value = ? WHERE key = 'user_store_version'",
      [USER_STORE_SCHEMA_VERSION],
    );
    return {
      applied: true,
      version: USER_STORE_SCHEMA_VERSION,
      fromVersion: fromVersion ?? afterV1.value,
    };
  }

  throw new Error(
    `Unsupported user store schema version ${afterV2?.value ?? afterV1.value}; expected ${USER_STORE_V1_VERSION}, ${USER_STORE_V2_VERSION}, or ${USER_STORE_SCHEMA_VERSION}`,
  );
}

/** Path helper for docs/smoke (relative to software/). */
export function userStoreSchemaPath(softwareRoot?: string): string {
  const root = softwareRoot ?? (typeof process !== 'undefined' ? process.cwd() : '');
  return `${root}/modules/food-catalog/schema/user-store-v1.sql`;
}

/** Returns bundled v1 SQL (no fs). Kept for callers that previously loaded from disk. */
export function loadUserStoreSchemaSql(_schemaPath?: string): string {
  return USER_STORE_V1_SQL;
}
