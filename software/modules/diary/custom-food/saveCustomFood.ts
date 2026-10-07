import {
  archiveCustomFood,
  createCustomFood,
  updateCustomFood,
  type CustomFood,
  type EnergyUnit,
  type SqlExecutor,
} from '../../app-core/user-data';
import { energyInputToKcalText } from '../../app-core/settings/unitDisplay';
import { validateCustomFoodDraft, type CustomFoodDraft } from './validateDraft';

export type SaveCustomFoodResult =
  | { ok: true; food: CustomFood }
  | { ok: false; reason: string };

export function saveCustomFoodCreate(
  db: SqlExecutor,
  draft: CustomFoodDraft,
  energyUnit: EnergyUnit = 'kcal',
): SaveCustomFoodResult {
  const v = validateCustomFoodDraft({
    ...draft,
    energyKcalText: energyInputToKcalText(draft.energyKcalText, energyUnit),
  });
  if (!v.ok) return v;
  try {
    const food = createCustomFood(db, {
      name: v.name,
      brand: v.brand,
      barcodeRaw: v.barcodeRaw,
      basisKind: v.basisKind,
      basisAmount: v.basisAmount,
      basisUnit: v.basisUnit,
      gramWeightForBasis: v.gramWeightForBasis,
      nutrients: v.nutrients,
    });
    return { ok: true, food };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export function saveCustomFoodEdit(
  db: SqlExecutor,
  id: string,
  draft: CustomFoodDraft,
  energyUnit: EnergyUnit = 'kcal',
): SaveCustomFoodResult {
  const v = validateCustomFoodDraft({
    ...draft,
    energyKcalText: energyInputToKcalText(draft.energyKcalText, energyUnit),
  });
  if (!v.ok) return v;
  try {
    const food = updateCustomFood(db, id, {
      name: v.name,
      brand: v.brand,
      barcodeRaw: v.barcodeRaw,
      basisKind: v.basisKind,
      basisAmount: v.basisAmount,
      basisUnit: v.basisUnit,
      gramWeightForBasis: v.gramWeightForBasis,
      nutrients: v.nutrients,
    });
    return { ok: true, food };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export function archiveCustomFoodSafe(
  db: SqlExecutor,
  id: string,
): SaveCustomFoodResult {
  try {
    const food = archiveCustomFood(db, id);
    return { ok: true, food };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
