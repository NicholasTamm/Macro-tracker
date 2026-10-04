import {
  archiveCustomFood,
  createCustomFood,
  updateCustomFood,
  type CustomFood,
  type SqlExecutor,
} from '../../app-core/user-data';
import { validateCustomFoodDraft, type CustomFoodDraft } from './validateDraft';

export type SaveCustomFoodResult =
  | { ok: true; food: CustomFood }
  | { ok: false; reason: string };

export function saveCustomFoodCreate(
  db: SqlExecutor,
  draft: CustomFoodDraft,
): SaveCustomFoodResult {
  const v = validateCustomFoodDraft(draft);
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
): SaveCustomFoodResult {
  const v = validateCustomFoodDraft(draft);
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
