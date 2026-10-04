/** M1-13 Food detail / log sheet — calc + atomic diary log. */
export {
  parseQuantityInput,
  quantityErrorMessage,
  isValidQuantity,
  type QuantityParseResult,
} from './parseQuantity';

export {
  roundNutrientValue,
  scaleNutrientsPer100g,
  scaleNutrientsByFactor,
  nutrientMapFromRows,
} from './scaleNutrients';

export {
  resolveSeedAmount,
  resolveCustomAmount,
  type ServingChoice,
  type UnitChoice,
  type ResolvedAmount,
  type CustomBasis,
} from './resolveAmount';

export {
  buildSeedFoodDetail,
  buildCustomFoodDetail,
  unitChoiceFromSelection,
  gramsUnitAvailable,
  type FoodDetailKind,
  type FoodDetailModel,
} from './buildFoodDetail';

export { computeLiveNutrients, type LiveNutrientPreview } from './computeLiveNutrients';

export { logFoodToDiary, type LogFoodInput, type LogFoodResult } from './logFoodEntry';
