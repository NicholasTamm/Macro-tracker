/**
 * Assemble a FoodDetailModel from seed (LocalFoodRepository) or custom food.
 */

import type { LocalFoodRepository } from '../../food-catalog/local-food-repo';
import type { CustomFood, NutrientMap } from '../../app-core/user-data';
import { nutrientMapFromRows } from './scaleNutrients';
import type { CustomBasis, ServingChoice } from './resolveAmount';

export type FoodDetailKind = 'seed' | 'custom';

export type FoodDetailModel = {
  kind: FoodDetailKind;
  foodStableId: string;
  displayName: string;
  brand: string | null;
  licenseTag: string;
  sourceDisplayName: string;
  /** Per-100 g nutrients for seed; basis nutrients for custom. */
  nutrients: NutrientMap;
  servings: ServingChoice[];
  /** Default unit: default serving when present, else grams. */
  defaultUnit: { kind: 'grams' } | { kind: 'serving'; servingId: number };
  /** Present for custom foods. */
  customBasis: CustomBasis | null;
  /** Suggested quantity for the default unit. */
  suggestedQuantity: number;
};

function licenseForSeedSource(sourceId: string): string {
  if (sourceId.startsWith('usda')) return 'USDA';
  return sourceId;
}

export function buildSeedFoodDetail(
  repo: LocalFoodRepository,
  foodId: string,
): FoodDetailModel | null {
  const food = repo.getFood(foodId);
  if (!food) return null;
  const source = repo.getSource(food.sourceId);
  const rawServings = repo.getServings(foodId);
  const servings: ServingChoice[] = rawServings.map((s) => ({
    servingId: s.servingId,
    quantity: s.quantity,
    unit: s.unit,
    modifier: s.modifier,
    gramWeight: s.gramWeight,
  }));
  const nutrients = nutrientMapFromRows(repo.getNutrients(foodId));
  const defaultRaw =
    rawServings.find((s) => s.isDefault) ??
    (food.defaultServingId != null
      ? rawServings.find((s) => s.servingId === food.defaultServingId)
      : undefined) ??
    rawServings[0];

  return {
    kind: 'seed',
    foodStableId: food.foodId,
    displayName: food.description,
    brand: null,
    licenseTag: licenseForSeedSource(food.sourceId),
    sourceDisplayName: source?.displayName ?? food.sourceId,
    nutrients,
    servings,
    defaultUnit: defaultRaw
      ? { kind: 'serving', servingId: defaultRaw.servingId }
      : { kind: 'grams' },
    customBasis: null,
    suggestedQuantity: 1,
  };
}

export function buildCustomFoodDetail(food: CustomFood): FoodDetailModel {
  const basis: CustomBasis = {
    basisKind: food.basisKind,
    basisAmount: food.basisAmount,
    basisUnit: food.basisUnit,
    gramWeightForBasis: food.gramWeightForBasis,
  };
  // Synthetic basis serving for the unit picker (resolve path uses customBasis).
  const servings: ServingChoice[] = [
    {
      servingId: 0,
      quantity: food.basisAmount,
      unit: food.basisUnit,
      modifier: null,
      gramWeight:
        food.gramWeightForBasis != null && food.gramWeightForBasis > 0
          ? food.gramWeightForBasis
          : food.basisAmount,
    },
  ];

  return {
    kind: 'custom',
    foodStableId: food.id,
    displayName: food.name,
    brand: food.brand,
    licenseTag: 'user-custom',
    sourceDisplayName: food.brand ? `My Foods · ${food.brand}` : 'My Foods',
    nutrients: food.nutrients,
    servings,
    defaultUnit: { kind: 'serving', servingId: 0 },
    customBasis: basis,
    suggestedQuantity: food.basisAmount > 0 ? food.basisAmount : 1,
  };
}


/** True when the Grams unit can resolve (seed always; custom needs gramWeightForBasis). */
export function gramsUnitAvailable(model: FoodDetailModel): boolean {
  if (model.kind === 'seed') return true;
  const g = model.customBasis?.gramWeightForBasis;
  return g != null && g > 0;
}

/** Pick UnitChoice from model + selected unit id (`grams` or serving id string). */
export function unitChoiceFromSelection(
  model: FoodDetailModel,
  selection: string,
): { kind: 'grams' } | { kind: 'serving'; serving: ServingChoice } | null {
  if (selection === 'grams') return { kind: 'grams' };
  const servingId = Number(selection);
  if (!Number.isFinite(servingId)) return null;
  const serving = model.servings.find((s) => s.servingId === servingId);
  if (!serving) return null;
  return { kind: 'serving', serving };
}
