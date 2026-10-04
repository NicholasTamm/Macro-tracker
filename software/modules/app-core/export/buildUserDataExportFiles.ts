import type { SqlExecutor } from '../user-data';
import { buildExportPayload } from './buildExportPayload';
import { buildExportFiles } from './toJson';
import { exportToCsvString } from './toCsv';
import type { ExportFiles, UserDataExport } from './types';

export function buildUserDataExport(
  db: SqlExecutor,
  opts: { exportedAt?: string } = {},
): UserDataExport {
  return buildExportPayload(db, opts);
}

export function buildUserDataExportFiles(
  db: SqlExecutor,
  opts: { exportedAt?: string } = {},
): ExportFiles {
  const payload = buildExportPayload(db, opts);
  const csv = exportToCsvString(payload);
  return buildExportFiles(payload, csv);
}
