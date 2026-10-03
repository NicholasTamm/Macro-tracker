/**
 * Live nutrient preview for the detail sheet given quantity + unit choice.
 */

import type { NutrientMap } from '../../app-core/user-data';
import { isValidQuantity } from './parseQuantity';
import {
  resolveCustomAmount,
  resolveSeedAmount,
  type CustomBasis,
  type UnitChoice,
} from './resolveAmount';
import { scaleNutrientsByFactor, scaleNutrientsPer100g } from './scaleNutrients';
import type { FoodDetailModel } from './buildFoodDetail';

export type LiveNutrientPreview = {
  ok: true;
  grams: number | null;
  quantity: number;
  unitLabel: string;
  nutritionSnapshot: NutrientMap;
} | {
  ok: false;
  reason: string;
};

export function computeLiveNutrients(
  model: FoodDetailModel,
  quantity: number,
  unit: UnitChoice,
): LiveNutrientPreview {
  if (!isValidQuantity(quantity)) {
    return { ok: false, reason: 'Quantity must be greater than zero.' };
  }

  try {
    if (model.kind === 'seed') {
      const resolved = resolveSeedAmount(quantity, unit);
      if (resolved.grams == null || !(resolved.grams > 0)) {
        return { ok: false, reason: 'Could not resolve grams for this serving.' };
      }
      const nutritionSnapshot = scaleNutrientsPer100g(model.nutrients, resolved.grams);
      return {
        ok: true,
        grams: resolved.grams,
        quantity: resolved.quantity,
        unitLabel: resolved.unitLabel,
        nutritionSnapshot,
      };
    }

    const basis = model.customBasis as CustomBasis;
    const resolved = resolveCustomAmount(quantity, unit, basis);
    if (resolved.customBasisFactor == null || !(resolved.customBasisFactor > 0)) {
      return { ok: false, reason: 'Could not resolve custom food amount.' };
    }
    const nutritionSnapshot = scaleNutrientsByFactor(
      model.nutrients,
      resolved.customBasisFactor,
    );
    return {
      ok: true,
      grams: resolved.grams,
      quantity: resolved.quantity,
      unitLabel: resolved.unitLabel,
      nutritionSnapshot,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
