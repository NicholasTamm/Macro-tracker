import type { SqlExecutor } from './sqlExecutor';
import { newEntityId, nowIso } from './ids';
import { parseNutrients, serializeNutrients, type NutrientMap } from './nutrients';

export type BasisKind = 'mass' | 'volume' | 'serving';

export type CustomFood = {
  id: string;
  name: string;
  brand: string | null;
  barcodeGtin14: string | null;
  basisKind: BasisKind;
  basisAmount: number;
  basisUnit: string;
  gramWeightForBasis: number | null;
  nutrients: NutrientMap;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  deletedAt: string | null;
  syncRevision: number;
};

export type CustomFoodCreate = {
  name: string;
  brand?: string | null;
  barcodeGtin14?: string | null;
  basisKind: BasisKind;
  basisAmount: number;
  basisUnit: string;
  gramWeightForBasis?: number | null;
  nutrients: NutrientMap;
};

function mapRow(row: Record<string, unknown>): CustomFood {
  return {
    id: String(row.id),
    name: String(row.name),
    brand: row.brand == null ? null : String(row.brand),
    barcodeGtin14: row.barcode_gtin14 == null ? null : String(row.barcode_gtin14),
    basisKind: row.basis_kind as BasisKind,
    basisAmount: Number(row.basis_amount),
    basisUnit: String(row.basis_unit),
    gramWeightForBasis:
      row.gram_weight_for_basis == null ? null : Number(row.gram_weight_for_basis),
    nutrients: parseNutrients(String(row.nutrients_json)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    isArchived: Number(row.is_archived) === 1,
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    syncRevision: Number(row.sync_revision),
  };
}

export function createCustomFood(db: SqlExecutor, input: CustomFoodCreate): CustomFood {
  const id = newEntityId();
  const ts = nowIso();
  db.run(
    `INSERT INTO custom_food (
      id, name, brand, barcode_gtin14, basis_kind, basis_amount, basis_unit,
      gram_weight_for_basis, nutrients_json, created_at, updated_at, is_archived, deleted_at, sync_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0)`,
    [
      id,
      input.name,
      input.brand ?? null,
      input.barcodeGtin14 ?? null,
      input.basisKind,
      input.basisAmount,
      input.basisUnit,
      input.gramWeightForBasis ?? null,
      serializeNutrients(input.nutrients),
      ts,
      ts,
    ],
  );
  const row = db.get(`SELECT * FROM custom_food WHERE id = ?`, [id]);
  if (!row) throw new Error('insert custom_food failed');
  return mapRow(row);
}

export function getCustomFood(db: SqlExecutor, id: string): CustomFood | undefined {
  const row = db.get(
    `SELECT * FROM custom_food WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  return row ? mapRow(row) : undefined;
}

export function updateCustomFoodNutrients(
  db: SqlExecutor,
  id: string,
  nutrients: NutrientMap,
): CustomFood {
  const ts = nowIso();
  db.run(
    `UPDATE custom_food SET nutrients_json = ?, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [serializeNutrients(nutrients), ts, id],
  );
  const food = getCustomFood(db, id);
  if (!food) throw new Error(`custom_food ${id} not found`);
  return food;
}

/** Soft-delete via tombstone. */
export function deleteCustomFood(db: SqlExecutor, id: string): void {
  const ts = nowIso();
  db.run(
    `UPDATE custom_food SET deleted_at = ?, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [ts, ts, id],
  );
}
