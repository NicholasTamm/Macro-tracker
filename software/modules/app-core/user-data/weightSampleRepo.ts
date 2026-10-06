import type { SqlExecutor } from './sqlExecutor';
import { newEntityId, nowIso } from './ids';

export type WeightSource = 'manual' | 'health' | 'import';

export type WeightSample = {
  id: string;
  timestamp: string;
  kilograms: number;
  source: WeightSource;
  confirmedOutlier: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncRevision: number;
};

function mapRow(row: Record<string, unknown>): WeightSample {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    kilograms: Number(row.kilograms),
    source: row.source as WeightSource,
    confirmedOutlier: Number(row.confirmed_outlier) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    syncRevision: Number(row.sync_revision),
  };
}

export function createWeightSample(
  db: SqlExecutor,
  input: {
    timestamp: string;
    kilograms: number;
    source?: WeightSource;
    confirmedOutlier?: boolean;
  },
): WeightSample {
  if (!(input.kilograms > 0)) throw new Error('Weight must be greater than zero.');
  const id = newEntityId();
  const ts = nowIso();
  const source = input.source ?? 'manual';
  db.run(
    `INSERT INTO weight_sample (
      id, timestamp, kilograms, source, confirmed_outlier,
      created_at, updated_at, deleted_at, sync_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
    [
      id,
      input.timestamp,
      input.kilograms,
      source,
      input.confirmedOutlier ? 1 : 0,
      ts,
      ts,
    ],
  );
  const row = db.get(`SELECT * FROM weight_sample WHERE id = ?`, [id]);
  if (!row) throw new Error('insert weight_sample failed');
  return mapRow(row);
}

export function listWeightSamples(
  db: SqlExecutor,
  opts: { includeDeleted?: boolean; limit?: number } = {},
): WeightSample[] {
  const limit = opts.limit ?? 10_000;
  const rows = opts.includeDeleted
    ? db.all(`SELECT * FROM weight_sample ORDER BY timestamp ASC LIMIT ?`, [limit])
    : db.all(
        `SELECT * FROM weight_sample WHERE deleted_at IS NULL ORDER BY timestamp ASC LIMIT ?`,
        [limit],
      );
  return rows.map(mapRow);
}

export function getWeightSample(
  db: SqlExecutor,
  id: string,
  opts: { includeDeleted?: boolean } = {},
): WeightSample | null {
  const row = opts.includeDeleted
    ? db.get(`SELECT * FROM weight_sample WHERE id = ?`, [id])
    : db.get(`SELECT * FROM weight_sample WHERE id = ? AND deleted_at IS NULL`, [id]);
  return row ? mapRow(row) : null;
}

/** Edit a live sample's weight and/or timestamp. Returns null if missing or tombstoned. */
export function updateWeightSample(
  db: SqlExecutor,
  id: string,
  patch: { kilograms?: number; timestamp?: string },
): WeightSample | null {
  const cur = getWeightSample(db, id);
  if (!cur) return null;
  const kilograms = patch.kilograms ?? cur.kilograms;
  if (!(kilograms > 0) || !Number.isFinite(kilograms)) {
    throw new Error('Weight must be greater than zero.');
  }
  const timestamp = patch.timestamp ?? cur.timestamp;
  db.run(
    `UPDATE weight_sample SET kilograms = ?, timestamp = ?, updated_at = ?,
       sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [kilograms, timestamp, nowIso(), id],
  );
  return getWeightSample(db, id);
}

/** Soft-delete (tombstone). Tombstoned samples are excluded from list/chart/summary. */
export function tombstoneWeightSample(db: SqlExecutor, id: string): void {
  const ts = nowIso();
  db.run(
    `UPDATE weight_sample SET deleted_at = ?, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [ts, ts, id],
  );
}

/** Undo a tombstone. Returns the restored sample, or null if it was not deleted. */
export function restoreWeightSample(db: SqlExecutor, id: string): WeightSample | null {
  db.run(
    `UPDATE weight_sample SET deleted_at = NULL, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NOT NULL`,
    [nowIso(), id],
  );
  return getWeightSample(db, id);
}
