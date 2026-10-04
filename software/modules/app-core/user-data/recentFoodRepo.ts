import type { SqlExecutor } from './sqlExecutor';
import type { FoodKind } from './favoriteRepo';
import { newEntityId, nowIso } from './ids';

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

export type RecentFoodTouch = {
  foodKind: FoodKind;
  foodStableId: string;
  foodDisplayName: string;
  foodLicenseTag: string;
  foodProviderId?: string | null;
  foodGtin14?: string | null;
  foodBrand?: string | null;
  quantity?: number | null;
  unit?: string | null;
  usedAt?: string;
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

/** Most recently used first (M1-12 browse). */
export function listRecentFoods(db: SqlExecutor, limit = 20): RecentFoodRecord[] {
  const rows = db.all(
    `SELECT * FROM recent_food ORDER BY last_used_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}

export function getRecentFood(
  db: SqlExecutor,
  foodKind: FoodKind,
  foodStableId: string,
): RecentFoodRecord | undefined {
  const row = db.get(
    `SELECT * FROM recent_food WHERE food_kind = ? AND food_stable_id = ?`,
    [foodKind, foodStableId],
  );
  return row ? mapRow(row) : undefined;
}

/**
 * Upsert recent_food: bump use_count, refresh last_used_at, store last qty/unit.
 * Call inside the same transaction as diary log when possible.
 */
export function recordRecentFood(
  db: SqlExecutor,
  input: RecentFoodTouch,
): RecentFoodRecord {
  const usedAt = input.usedAt ?? nowIso();
  const existing = getRecentFood(db, input.foodKind, input.foodStableId);
  if (existing) {
    const qty =
      input.quantity !== undefined ? input.quantity : existing.lastQuantity;
    const unit = input.unit !== undefined ? input.unit : existing.lastUnit;
    db.run(
      `UPDATE recent_food SET
        food_display_name = ?,
        food_brand = ?,
        food_license_tag = ?,
        food_provider_id = ?,
        food_gtin14 = ?,
        last_used_at = ?,
        use_count = use_count + 1,
        last_quantity = ?,
        last_unit = ?
       WHERE food_kind = ? AND food_stable_id = ?`,
      [
        input.foodDisplayName,
        input.foodBrand ?? existing.foodBrand,
        input.foodLicenseTag,
        input.foodProviderId ?? existing.foodProviderId,
        input.foodGtin14 ?? existing.foodGtin14,
        usedAt,
        qty ?? null,
        unit ?? null,
        input.foodKind,
        input.foodStableId,
      ],
    );
  } else {
    const id = newEntityId();
    db.run(
      `INSERT INTO recent_food (
        id, food_kind, food_stable_id, food_provider_id, food_gtin14,
        food_display_name, food_brand, food_license_tag,
        last_used_at, use_count, last_quantity, last_unit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        input.foodKind,
        input.foodStableId,
        input.foodProviderId ?? null,
        input.foodGtin14 ?? null,
        input.foodDisplayName,
        input.foodBrand ?? null,
        input.foodLicenseTag,
        usedAt,
        input.quantity ?? null,
        input.unit ?? null,
      ],
    );
  }
  const row = getRecentFood(db, input.foodKind, input.foodStableId);
  if (!row) throw new Error('recordRecentFood failed');
  return row;
}
