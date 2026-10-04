import {
  validateCustomFoodFields,
  type BasisKind,
  type NutrientMap,
} from '../../app-core/user-data';

export type CustomFoodDraft = {
  name: string;
  brand: string;
  barcodeRaw: string;
  basisKind: BasisKind;
  basisAmountText: string;
  basisUnit: string;
  gramWeightText: string;
  energyKcalText: string;
  proteinText: string;
  carbohydrateText: string;
  fatTotalText: string;
  /** Optional micros: key → raw text; empty = missing; "0" = explicit zero */
  optionalNutrients: Record<string, string>;
};

export type DraftValidation =
  | {
      ok: true;
      name: string;
      brand: string | null;
      barcodeRaw: string | null;
      basisKind: BasisKind;
      basisAmount: number;
      basisUnit: string;
      gramWeightForBasis: number | null;
      nutrients: NutrientMap;
    }
  | { ok: false; reason: string };

function parseRequiredNumber(raw: string, label: string): number | { error: string } {
  const t = raw.trim();
  if (!t) return { error: `${label} is required.` };
  const n = Number(t);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  if (n < 0) return { error: `${label} cannot be negative.` };
  return n;
}

function parseOptionalMacroZeroAllowed(
  raw: string,
  label: string,
): number | { error: string } {
  // Macros are required — empty is error (use 0 explicitly for none)
  return parseRequiredNumber(raw, label);
}

export function validateCustomFoodDraft(draft: CustomFoodDraft): DraftValidation {
  const name = draft.name.trim();
  if (!name) return { ok: false, reason: 'Name is required.' };

  const basisAmount = parseRequiredNumber(draft.basisAmountText, 'Basis amount');
  if (typeof basisAmount === 'object') return { ok: false, reason: basisAmount.error };

  const energy = parseOptionalMacroZeroAllowed(draft.energyKcalText, 'Energy (kcal)');
  if (typeof energy === 'object') return { ok: false, reason: energy.error };
  const protein = parseOptionalMacroZeroAllowed(draft.proteinText, 'Protein (g)');
  if (typeof protein === 'object') return { ok: false, reason: protein.error };
  const carb = parseOptionalMacroZeroAllowed(draft.carbohydrateText, 'Carbohydrate (g)');
  if (typeof carb === 'object') return { ok: false, reason: carb.error };
  const fat = parseOptionalMacroZeroAllowed(draft.fatTotalText, 'Fat (g)');
  if (typeof fat === 'object') return { ok: false, reason: fat.error };

  let gramWeightForBasis: number | null = null;
  const gw = draft.gramWeightText.trim();
  if (gw) {
    const n = Number(gw);
    if (!Number.isFinite(n) || !(n > 0)) {
      return { ok: false, reason: 'Gram weight must be greater than zero when set.' };
    }
    gramWeightForBasis = n;
  }

  const nutrients: NutrientMap = {
    energy_kcal: energy,
    protein,
    carbohydrate: carb,
    fat_total: fat,
  };

  for (const [k, raw] of Object.entries(draft.optionalNutrients)) {
    const t = raw.trim();
    if (!t) {
      // omit → missing
      continue;
    }
    if (t.toLowerCase() === 'null' || t === '—') {
      nutrients[k] = null;
      continue;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, reason: `Optional nutrient ${k} must be a non-negative number.` };
    }
    nutrients[k] = n;
  }

  const barcodeRaw = draft.barcodeRaw.trim() ? draft.barcodeRaw.trim() : null;
  const validated = validateCustomFoodFields({
    name,
    basisKind: draft.basisKind,
    basisAmount,
    basisUnit: draft.basisUnit,
    gramWeightForBasis,
    nutrients,
    barcodeRaw,
  });
  if (!validated.ok) return validated;

  return {
    ok: true,
    name,
    brand: draft.brand.trim() ? draft.brand.trim() : null,
    barcodeRaw,
    basisKind: draft.basisKind,
    basisAmount,
    basisUnit: draft.basisUnit.trim() || 'g',
    gramWeightForBasis,
    nutrients,
  };
}
