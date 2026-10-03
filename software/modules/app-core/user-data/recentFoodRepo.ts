import type { SqlExecutor } from './sqlExecutor';
import type { FoodKind } from './favoriteRepo';

export type RecentFoodRecord = {
  id: string;
  foodKind: FoodKind;
  foodStableId: string;
  foodProviderId: string | null;
  foodGtin14: string | null;
  foodDisplayName: string;
  foodBrand: string | null;
  foodLicenseTag: string;
  lastUsedAt: string;
  useCount: number;
  lastQuantity: number | null;
  lastUnit: string | null;
};

function mapRow(row: Record<string, unknown>): RecentFoodRecord {
  return {
    id: String(row.id),
    foodKind: row.food_kind as FoodKind,
    foodStableId: String(row.food_stable_id),
    foodProviderId: row.food_provider_id == null ? null : String(row.food_provider_id),
    foodGtin14: row.food_gtin14 == null ? null : String(row.food_gtin14),
    foodDisplayName: String(row.food_display_name),
    foodBrand: row.food_brand == null ? null : String(row.food_brand),
    foodLicenseTag: String(row.food_license_tag),
    lastUsedAt: String(row.last_used_at),
    useCount: Number(row.use_count),
    lastQuantity: row.last_quantity == null ? null : Number(row.last_quantity),
    lastUnit: row.last_unit == null ? null : String(row.last_unit),
  };
}

/** Most recently used first (M1-12 browse; writes in M1-16). */
export function listRecentFoods(db: SqlExecutor, limit = 20): RecentFoodRecord[] {
  const rows = db.all(
    `SELECT * FROM recent_food ORDER BY last_used_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}
