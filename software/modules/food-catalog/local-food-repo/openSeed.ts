/**
 * Open read-only FoodSeed.sqlite for LocalFoodRepository.
 *
 * - sql.js bytes: openSeedBytes — exact/getById; FTS falls back when FTS5 missing
 * - Expo: wrapExpoSqliteSeed(SQLite.openDatabaseSync(...)) after asset copy
 * - Node FTS5 tests: see openSeedNode.ts (node-sqlite3-wasm)
 */
import initSqlJs from 'sql.js';
import type { SqlExecutor, SqlRow } from './sqlTypes';

export type OpenSeedOptions = {
  /** When true (default), refuse write attempts at the executor layer. */
  readOnly?: boolean;
};

function guardReadOnly(sql: string, readOnly: boolean): void {
  if (!readOnly) return;
  const head = sql.replace(/^\s+/, '').slice(0, 48).toUpperCase();
  if (
    head.startsWith('SELECT') ||
    head.startsWith('WITH') ||
    head.startsWith('PRAGMA') ||
    head.startsWith('EXPLAIN')
  ) {
    return;
  }
  throw new Error(`FoodSeed is read-only; refused SQL: ${sql.slice(0, 80)}`);
}

export function wrapReadOnly(inner: SqlExecutor, readOnly: boolean): SqlExecutor {
  if (!readOnly) return inner;
  return {
    exec(sql: string) {
      guardReadOnly(sql, true);
      inner.exec(sql);
    },
    run(sql: string, params: unknown[] = []) {
      guardReadOnly(sql, true);
      inner.run(sql, params);
    },
    get<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      guardReadOnly(sql, true);
      return inner.get<T>(sql, params);
    },
    all<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      guardReadOnly(sql, true);
      return inner.all<T>(sql, params);
    },
    close() {
      inner.close();
    },
    exportBytes: inner.exportBytes ? () => inner.exportBytes!() : undefined,
  };
}

/** Open FoodSeed from bytes via sql.js (stock build has no FTS5). */
export async function openSeedBytes(
  bytes: ArrayLike<number>,
  opts: OpenSeedOptions = {},
): Promise<SqlExecutor> {
  const readOnly = opts.readOnly !== false;
  const SQL = await initSqlJs();
  const db = new SQL.Database(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  );
  const inner: SqlExecutor = {
    exec(sql: string) {
      db.exec(sql);
    },
    run(sql: string, params: unknown[] = []) {
      db.run(sql, params as never[]);
    },
    get<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      const stmt = db.prepare(sql);
      try {
        if (params.length) stmt.bind(params as never[]);
        if (!stmt.step()) return undefined;
        return stmt.getAsObject() as T;
      } finally {
        stmt.free();
      }
    },
    all<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      const stmt = db.prepare(sql);
      const rows: T[] = [];
      try {
        if (params.length) stmt.bind(params as never[]);
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    close() {
      db.close();
    },
    exportBytes() {
      return db.export();
    },
  };
  return wrapReadOnly(inner, readOnly);
}

/**
 * Expo runtime adapter. Pass the result of
 * `SQLite.openDatabaseSync('FoodSeed.sqlite')` (after copying the bundled
 * asset into the document directory) or an already-opened read-only handle.
 */
export function wrapExpoSqliteSeed(
  db: {
    execSync: (sql: string) => void;
    runSync: (sql: string, params?: unknown[]) => void;
    getFirstSync: <T>(sql: string, params?: unknown[]) => T | null;
    getAllSync: <T>(sql: string, params?: unknown[]) => T[];
    closeSync?: () => void;
  },
  opts: OpenSeedOptions = {},
): SqlExecutor {
  const readOnly = opts.readOnly !== false;
  const inner: SqlExecutor = {
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
  return wrapReadOnly(inner, readOnly);
}

/** Bundled fixture path relative to software/ (until CDN / M1-20). */
export const FIXTURE_SEED_RELATIVE_PATH =
  'modules/food-catalog/assets/FoodSeed.fixture.sqlite';
