import { type Database } from 'sql.js';
import { initializeSqlJs } from '../../sqlite/sqlJs';
import type { SqlExecutor, SqlRow } from './sqlExecutor';

export async function openSqlJsDatabase(bytes?: ArrayLike<number>): Promise<SqlExecutor> {
  const SQL = await initializeSqlJs('user data storage');
  const db: Database = bytes
    ? new SQL.Database(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    : new SQL.Database();

  return {
    exec(sql: string) {
      // multi-statement DDL
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
}
