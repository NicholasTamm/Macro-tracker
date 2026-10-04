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
