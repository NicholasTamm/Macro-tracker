import type { SqlExecutor } from './sqlExecutor';

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

/** Newest favorites first (M1-12 browse; writes in M1-16). */
export function listFavorites(db: SqlExecutor, limit = 50): FavoriteRecord[] {
  const rows = db.all(
    `SELECT * FROM favorite ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}
