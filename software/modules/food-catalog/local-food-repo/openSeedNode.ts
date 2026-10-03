/**
 * Node-only FoodSeed open (FTS5 via node-sqlite3-wasm).
 * Do not import from Expo/RN bundles — use openSeed.ts there.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { openSeedBytes, wrapReadOnly, type OpenSeedOptions } from './openSeed';
import type { SqlExecutor, SqlRow } from './sqlTypes';

/** Open an on-disk FoodSeed with node-sqlite3-wasm (FTS5-capable). */
export function openSeedFile(
  filePath: string,
  opts: OpenSeedOptions = {},
): SqlExecutor {
  const readOnly = opts.readOnly !== false;
  // Resolve from software package root (works in CJS and ESM runners).
  const nodeRequire = createRequire(join(process.cwd(), 'package.json'));
  const mod = nodeRequire('node-sqlite3-wasm') as {
    Database: new (
      path: string,
      options?: { readonly?: boolean },
    ) => {
      exec(sql: string): void;
      run(sql: string, params?: unknown[]): void;
      get(sql: string, params?: unknown[]): SqlRow | undefined;
      all(sql: string, params?: unknown[]): SqlRow[];
      close(): void;
    };
  };
  const db = new mod.Database(filePath, { readonly: readOnly });
  const inner: SqlExecutor = {
    exec(sql: string) {
      db.exec(sql);
    },
    run(sql: string, params: unknown[] = []) {
      db.run(sql, params);
    },
    get<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      return db.get(sql, params) as T | undefined;
    },
    all<T extends SqlRow = SqlRow>(sql: string, params: unknown[] = []) {
      return db.all(sql, params) as T[];
    },
    close() {
      db.close();
    },
  };
  return wrapReadOnly(inner, readOnly);
}

/** Load file bytes then open via sql.js (no FTS5). */
export async function openSeedFileViaSqlJs(
  filePath: string,
  opts: OpenSeedOptions = {},
): Promise<SqlExecutor> {
  const bytes = readFileSync(filePath);
  return openSeedBytes(bytes, opts);
}
