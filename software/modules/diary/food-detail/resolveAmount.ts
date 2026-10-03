/**
 * Resolve logged quantity + unit choice → grams, unitLabel, and scale inputs.
 */

export type ServingChoice = {
  servingId: number;
  /** Source serving quantity (e.g. 1.0 for "1 egg"). */
  quantity: number;
  unit: string;
  modifier?: string | null;
  /** Grams for `quantity` units of this serving. */
  gramWeight: number;
};

export type UnitChoice =
  | { kind: 'grams' }
  | { kind: 'serving'; serving: ServingChoice };

export type ResolvedAmount = {
  /** User-facing quantity entered on the sheet. */
  quantity: number;
  /** Unit label persisted on the diary entry. */
  unitLabel: string;
  /** Absolute grams for nutrient scaling (null only if custom basis has no gram weight). */
  grams: number | null;
  /** Scale factor for custom basis nutrients (quantity / basisAmount), when applicable. */
  customBasisFactor: number | null;
};

export type CustomBasis = {
  basisKind: 'mass' | 'volume' | 'serving';
  basisAmount: number;
  basisUnit: string;
  gramWeightForBasis: number | null;
};

function servingUnitLabel(serving: ServingChoice): string {
  const mod = serving.modifier?.trim();
  if (mod) return `${serving.unit} (${mod})`;
  return serving.unit;
}

/**
 * Seed foods: grams unit or a catalog serving.
 * grams = qty (grams mode) or qty * (serving.gramWeight / serving.quantity).
 */
export function resolveSeedAmount(quantity: number, unit: UnitChoice): ResolvedAmount {
  if (!(typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0)) {
    throw new Error('resolveSeedAmount: quantity must be positive and finite');
  }
  if (unit.kind === 'grams') {
    return {
      quantity,
      unitLabel: 'g',
      grams: quantity,
      customBasisFactor: null,
    };
  }
  const { serving } = unit;
  if (!(serving.quantity > 0) || !(serving.gramWeight > 0)) {
    throw new Error('resolveSeedAmount: serving quantity/gramWeight must be positive');
  }
  const grams = quantity * (serving.gramWeight / serving.quantity);
  return {
    quantity,
    unitLabel: servingUnitLabel(serving),
    grams,
    customBasisFactor: null,
  };
}

/**
 * Custom foods: log in basis unit or in grams when gramWeightForBasis is known.
 */
export function resolveCustomAmount(
  quantity: number,
  unit: UnitChoice,
  basis: CustomBasis,
): ResolvedAmount {
  if (!(typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0)) {
    throw new Error('resolveCustomAmount: quantity must be positive and finite');
  }
  if (!(basis.basisAmount > 0)) {
    throw new Error('resolveCustomAmount: basisAmount must be positive');
  }

  if (unit.kind === 'grams') {
    if (basis.gramWeightForBasis == null || !(basis.gramWeightForBasis > 0)) {
      throw new Error('resolveCustomAmount: grams unit requires gramWeightForBasis');
    }
    // Nutrients are for basisAmount; grams scale via gramWeightForBasis.
    const factor = quantity / basis.gramWeightForBasis;
    return {
      quantity,
      unitLabel: 'g',
      grams: quantity,
      customBasisFactor: factor,
    };
  }

  // Logging in "basis" serving: one synthetic serving = basisAmount basisUnit.
  const factor = quantity / basis.basisAmount;
  const grams =
    basis.gramWeightForBasis != null && basis.gramWeightForBasis > 0
      ? quantity * (basis.gramWeightForBasis / basis.basisAmount)
      : null;
  return {
    quantity,
    unitLabel: basis.basisUnit,
    grams,
    customBasisFactor: factor,
  };
}
