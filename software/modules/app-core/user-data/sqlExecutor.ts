/**
 * Minimal SQL executor shared by Node (sql.js) tests and Expo (expo-sqlite) adapters.
 */
export type SqlRow = Record<string, unknown>;

export type SqlExecutor = {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): void;
  get<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): T | undefined;
  all<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): T[];
  close(): void;
  /** Optional: sql.js (and similar) can snapshot bytes for relaunch persistence. */
  exportBytes?: () => Uint8Array;
};
