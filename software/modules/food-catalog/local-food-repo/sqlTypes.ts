/**
 * Minimal SQL executor (mirrors app-core/user-data SqlExecutor) so
 * food-catalog does not hard-depend on user-data at type level.
 */
export type SqlRow = Record<string, unknown>;

export type SqlExecutor = {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): void;
  get<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): T | undefined;
  all<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): T[];
  close(): void;
  exportBytes?: () => Uint8Array;
};
