import type { SqlExecutor } from './sqlExecutor';
import { newEntityId, nowIso } from './ids';

export type FoodKind = 'seed' | 'custom' | 'off' | 'fdc_branded' | 'fatsecret';

export type FavoriteRecord = {
  id: string;
  foodKind: FoodKind;
  foodStableId: string;
  foodProviderId: string | null;
  foodGtin14: string | null;
  foodDisplayName: string;
  foodBrand: string | null;
  foodLicenseTag: string;
  createdAt: string;
};

export type FavoriteInput = {
  foodKind: FoodKind;
  foodStableId: string;
  foodDisplayName: string;
  foodLicenseTag: string;
  foodProviderId?: string | null;
  foodGtin14?: string | null;
  foodBrand?: string | null;
};

function mapRow(row: Record<string, unknown>): FavoriteRecord {
  return {
    id: String(row.id),
    foodKind: row.food_kind as FoodKind,
    foodStableId: String(row.food_stable_id),
    foodProviderId: row.food_provider_id == null ? null : String(row.food_provider_id),
    foodGtin14: row.food_gtin14 == null ? null : String(row.food_gtin14),
    foodDisplayName: String(row.food_display_name),
    foodBrand: row.food_brand == null ? null : String(row.food_brand),
    foodLicenseTag: String(row.food_license_tag),
    createdAt: String(row.created_at),
  };
}

/** Newest favorites first (M1-12 browse). */
export function listFavorites(db: SqlExecutor, limit = 50): FavoriteRecord[] {
  const rows = db.all(
    `SELECT * FROM favorite ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}

export function getFavorite(
  db: SqlExecutor,
  foodKind: FoodKind,
  foodStableId: string,
): FavoriteRecord | undefined {
  const row = db.get(
    `SELECT * FROM favorite WHERE food_kind = ? AND food_stable_id = ?`,
    [foodKind, foodStableId],
  );
  return row ? mapRow(row) : undefined;
}

export function isFavorite(
  db: SqlExecutor,
  foodKind: FoodKind,
  foodStableId: string,
): boolean {
  return getFavorite(db, foodKind, foodStableId) != null;
}

/** Add favorite; idempotent on (food_kind, food_stable_id). */
export function addFavorite(db: SqlExecutor, input: FavoriteInput): FavoriteRecord {
  const existing = getFavorite(db, input.foodKind, input.foodStableId);
  if (existing) return existing;
  const id = newEntityId();
  const ts = nowIso();
  db.run(
    `INSERT INTO favorite (
      id, food_kind, food_stable_id, food_provider_id, food_gtin14,
      food_display_name, food_brand, food_license_tag, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.foodKind,
      input.foodStableId,
      input.foodProviderId ?? null,
      input.foodGtin14 ?? null,
      input.foodDisplayName,
      input.foodBrand ?? null,
      input.foodLicenseTag,
      ts,
    ],
  );
  const row = getFavorite(db, input.foodKind, input.foodStableId);
  if (!row) throw new Error('addFavorite failed');
  return row;
}

export function removeFavorite(
  db: SqlExecutor,
  foodKind: FoodKind,
  foodStableId: string,
): void {
  db.run(`DELETE FROM favorite WHERE food_kind = ? AND food_stable_id = ?`, [
    foodKind,
    foodStableId,
  ]);
}

export function toggleFavorite(
  db: SqlExecutor,
  input: FavoriteInput,
): { favorited: boolean; record: FavoriteRecord | null } {
  if (isFavorite(db, input.foodKind, input.foodStableId)) {
    removeFavorite(db, input.foodKind, input.foodStableId);
    return { favorited: false, record: null };
  }
  const record = addFavorite(db, input);
  return { favorited: true, record };
}
