import type { SqlExecutor } from './sqlExecutor';
import { newEntityId, nowIso } from './ids';
import { parseNutrients, serializeNutrients, type NutrientMap } from './nutrients';
import { validateAndNormalizeBarcode } from './barcode';

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
  /** Raw barcode string — normalized/validated when set; overrides barcodeGtin14 if both given. */
  barcodeRaw?: string | null;
  basisKind: BasisKind;
  basisAmount: number;
  basisUnit: string;
  gramWeightForBasis?: number | null;
  nutrients: NutrientMap;
};

export type CustomFoodUpdate = {
  name?: string;
  brand?: string | null;
  barcodeGtin14?: string | null;
  barcodeRaw?: string | null;
  basisKind?: BasisKind;
  basisAmount?: number;
  basisUnit?: string;
  gramWeightForBasis?: number | null;
  nutrients?: NutrientMap;
};

/** Required macro keys — must be present as numbers (0 allowed; null/missing rejected). */
export const REQUIRED_MACRO_KEYS = [
  'energy_kcal',
  'protein',
  'carbohydrate',
  'fat_total',
] as const;

export type CustomFoodValidation =
  | { ok: true; barcodeGtin14: string | null }
  | { ok: false; reason: string };

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

export function validateCustomFoodFields(input: {
  name: string;
  basisKind: BasisKind;
  basisAmount: number;
  basisUnit: string;
  gramWeightForBasis?: number | null;
  nutrients: NutrientMap;
  barcodeRaw?: string | null;
  barcodeGtin14?: string | null;
}): CustomFoodValidation {
  const name = input.name?.trim() ?? '';
  if (!name) return { ok: false, reason: 'Name is required.' };
  if (!['mass', 'volume', 'serving'].includes(input.basisKind)) {
    return { ok: false, reason: 'Invalid basis kind.' };
  }
  if (!(input.basisAmount > 0)) {
    return { ok: false, reason: 'Basis amount must be greater than zero.' };
  }
  if (!input.basisUnit?.trim()) {
    return { ok: false, reason: 'Basis unit is required.' };
  }
  if (
    input.gramWeightForBasis != null &&
    !(Number(input.gramWeightForBasis) > 0)
  ) {
    return { ok: false, reason: 'Gram weight for basis must be greater than zero when set.' };
  }

  for (const key of REQUIRED_MACRO_KEYS) {
    const v = input.nutrients[key];
    if (v === undefined || v === null || typeof v !== 'number' || Number.isNaN(v)) {
      return {
        ok: false,
        reason: `Macro ${key} is required (use 0 for none — do not leave missing).`,
      };
    }
    if (v < 0) {
      return { ok: false, reason: `Macro ${key} cannot be negative.` };
    }
  }

  // Optional nutrients: null = missing, number = present (incl. zero)
  for (const [k, v] of Object.entries(input.nutrients)) {
    if ((REQUIRED_MACRO_KEYS as readonly string[]).includes(k)) continue;
    if (v === undefined) continue;
    if (v === null) continue;
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0) {
      return { ok: false, reason: `Nutrient ${k} must be a non-negative number or null.` };
    }
  }

  const barcodeSource =
    input.barcodeRaw !== undefined ? input.barcodeRaw : input.barcodeGtin14;
  const barcode = validateAndNormalizeBarcode(barcodeSource);
  if (!barcode.ok) return barcode;
  return { ok: true, barcodeGtin14: barcode.gtin14 };
}

export function createCustomFood(db: SqlExecutor, input: CustomFoodCreate): CustomFood {
  const validated = validateCustomFoodFields({
    name: input.name,
    basisKind: input.basisKind,
    basisAmount: input.basisAmount,
    basisUnit: input.basisUnit,
    gramWeightForBasis: input.gramWeightForBasis,
    nutrients: input.nutrients,
    barcodeRaw: input.barcodeRaw,
    barcodeGtin14: input.barcodeGtin14,
  });
  if (!validated.ok) {
    throw new Error(validated.reason);
  }

  const id = newEntityId();
  const ts = nowIso();
  const name = input.name.trim();
  db.run(
    `INSERT INTO custom_food (
      id, name, brand, barcode_gtin14, basis_kind, basis_amount, basis_unit,
      gram_weight_for_basis, nutrients_json, created_at, updated_at, is_archived, deleted_at, sync_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0)`,
    [
      id,
      name,
      input.brand?.trim() ? input.brand.trim() : null,
      validated.barcodeGtin14,
      input.basisKind,
      input.basisAmount,
      input.basisUnit.trim(),
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
  return updateCustomFood(db, id, { nutrients });
}

/**
 * Update custom food fields. Never touches diary_entry nutrition snapshots.
 */
export function updateCustomFood(
  db: SqlExecutor,
  id: string,
  patch: CustomFoodUpdate,
): CustomFood {
  const cur = getCustomFood(db, id);
  if (!cur) throw new Error(`custom_food ${id} not found`);

  const next = {
    name: patch.name !== undefined ? patch.name : cur.name,
    brand: patch.brand !== undefined ? patch.brand : cur.brand,
    basisKind: patch.basisKind !== undefined ? patch.basisKind : cur.basisKind,
    basisAmount: patch.basisAmount !== undefined ? patch.basisAmount : cur.basisAmount,
    basisUnit: patch.basisUnit !== undefined ? patch.basisUnit : cur.basisUnit,
    gramWeightForBasis:
      patch.gramWeightForBasis !== undefined
        ? patch.gramWeightForBasis
        : cur.gramWeightForBasis,
    nutrients: patch.nutrients !== undefined ? patch.nutrients : cur.nutrients,
    barcodeRaw: patch.barcodeRaw,
    barcodeGtin14:
      patch.barcodeRaw !== undefined
        ? undefined
        : patch.barcodeGtin14 !== undefined
          ? patch.barcodeGtin14
          : cur.barcodeGtin14,
  };

  const validated = validateCustomFoodFields({
    name: next.name,
    basisKind: next.basisKind,
    basisAmount: next.basisAmount,
    basisUnit: next.basisUnit,
    gramWeightForBasis: next.gramWeightForBasis,
    nutrients: next.nutrients,
    barcodeRaw: next.barcodeRaw,
    barcodeGtin14: next.barcodeGtin14,
  });
  if (!validated.ok) throw new Error(validated.reason);

  const ts = nowIso();
  db.run(
    `UPDATE custom_food SET
      name = ?, brand = ?, barcode_gtin14 = ?, basis_kind = ?, basis_amount = ?,
      basis_unit = ?, gram_weight_for_basis = ?, nutrients_json = ?,
      updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [
      next.name.trim(),
      next.brand?.trim() ? next.brand.trim() : null,
      validated.barcodeGtin14,
      next.basisKind,
      next.basisAmount,
      next.basisUnit.trim(),
      next.gramWeightForBasis ?? null,
      serializeNutrients(next.nutrients),
      ts,
      id,
    ],
  );
  const food = getCustomFood(db, id);
  if (!food) throw new Error(`custom_food ${id} not found after update`);
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

/** Archive (hide from My Foods) without deleting. Does not touch diary snapshots. */
export function archiveCustomFood(db: SqlExecutor, id: string): CustomFood {
  const ts = nowIso();
  db.run(
    `UPDATE custom_food SET is_archived = 1, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [ts, id],
  );
  const food = getCustomFood(db, id);
  if (!food) throw new Error(`custom_food ${id} not found`);
  return food;
}

export function unarchiveCustomFood(db: SqlExecutor, id: string): CustomFood {
  const ts = nowIso();
  db.run(
    `UPDATE custom_food SET is_archived = 0, updated_at = ?, sync_revision = sync_revision + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [ts, id],
  );
  const food = getCustomFood(db, id);
  if (!food) throw new Error(`custom_food ${id} not found`);
  return food;
}

/** Active (non-deleted, non-archived) custom foods for My Foods browse (M1-12). */
export function listCustomFoods(
  db: SqlExecutor,
  opts: { limit?: number; includeArchived?: boolean } = {},
): CustomFood[] {
  const limit = opts.limit ?? 50;
  const includeArchived = opts.includeArchived === true;
  const rows = includeArchived
    ? db.all(
        `SELECT * FROM custom_food WHERE deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT ?`,
        [limit],
      )
    : db.all(
        `SELECT * FROM custom_food WHERE deleted_at IS NULL AND is_archived = 0
         ORDER BY updated_at DESC LIMIT ?`,
        [limit],
      );
  return rows.map(mapRow);
}
