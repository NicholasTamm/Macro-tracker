/**
 * Quick-add from Recent/Favorites into a meal slot (M1-16).
 * Uses remembered last quantity/unit when available; otherwise model defaults.
 */
import {
  getCustomFood,
  getRecentFood,
  type FoodKind,
  type SqlExecutor,
} from '../../app-core/user-data';
import {
  buildCustomFoodDetail,
  buildSeedFoodDetail,
  logFoodToDiary,
  unitChoiceFromSelection,
  type FoodDetailModel,
  type LogFoodResult,
  type UnitChoice,
} from '../food-detail';
import type { LocalFoodRepository } from '../../food-catalog/local-food-repo';

export type QuickAddInput = {
  foodKind: FoodKind;
  foodStableId: string;
  mealSlotId: string | null;
  /** Optional override quantity; else last remembered or model suggested. */
  quantity?: number;
  localDayKey?: string;
  timestamp?: string;
  timezoneIdentifier?: string;
};

export type QuickAddResult =
  | { ok: true; entryId: string; quantity: number; unitLabel: string }
  | { ok: false; reason: string };

function defaultUnitChoice(model: FoodDetailModel): UnitChoice {
  const sel =
    model.defaultUnit.kind === 'grams'
      ? 'grams'
      : String(model.defaultUnit.servingId);
  const choice = unitChoiceFromSelection(model, sel);
  if (choice) return choice;
  if (model.servings[0]) return { kind: 'serving', serving: model.servings[0] };
  return { kind: 'grams' };
}

/** Map stored last_unit (unitLabel or 'grams'/serving id) back to UnitChoice. */
export function unitFromRemembered(
  model: FoodDetailModel,
  lastUnit: string | null | undefined,
): UnitChoice {
  if (!lastUnit) return defaultUnitChoice(model);
  const lower = lastUnit.toLowerCase();
  if (lower === 'g' || lower === 'grams' || lower === 'gram') {
    return unitChoiceFromSelection(model, 'grams') ?? defaultUnitChoice(model);
  }
  if (/^\d+$/.test(lastUnit) && model.servings.some((s) => String(s.servingId) === lastUnit)) {
    return unitChoiceFromSelection(model, lastUnit) ?? defaultUnitChoice(model);
  }
  const byUnit = model.servings.find((s) => s.unit === lastUnit);
  if (byUnit) {
    return unitChoiceFromSelection(model, String(byUnit.servingId)) ?? defaultUnitChoice(model);
  }
  return defaultUnitChoice(model);
}

export function resolveQuickAddModel(
  db: SqlExecutor,
  seedRepo: LocalFoodRepository | null,
  foodKind: FoodKind,
  foodStableId: string,
): FoodDetailModel | null {
  if (foodKind === 'seed') {
    if (!seedRepo) return null;
    return buildSeedFoodDetail(seedRepo, foodStableId);
  }
  if (foodKind === 'custom') {
    const custom = getCustomFood(db, foodStableId);
    if (!custom) return null;
    return buildCustomFoodDetail(custom);
  }
  return null;
}

export function quickAddFood(
  db: SqlExecutor,
  seedRepo: LocalFoodRepository | null,
  input: QuickAddInput,
): QuickAddResult {
  const model = resolveQuickAddModel(db, seedRepo, input.foodKind, input.foodStableId);
  if (!model) {
    return { ok: false, reason: 'Food not available for quick-add.' };
  }

  const recent = getRecentFood(db, input.foodKind, input.foodStableId);
  const quantity =
    input.quantity ?? recent?.lastQuantity ?? model.suggestedQuantity;
  const unit = unitFromRemembered(model, recent?.lastUnit ?? null);

  const result: LogFoodResult = logFoodToDiary(db, {
    model,
    quantity,
    unit,
    mealSlotId: input.mealSlotId,
    timestamp: input.timestamp,
    localDayKey: input.localDayKey,
    timezoneIdentifier: input.timezoneIdentifier,
  });

  if (!result.ok) return result;
  return {
    ok: true,
    entryId: result.entry.id,
    quantity: result.entry.quantity,
    unitLabel: result.entry.unitLabel,
  };
}
