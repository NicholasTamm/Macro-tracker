/**
 * Canonical nutrient IDs for FoodSeed v1 / diary snapshots.
 * Required nutrients reject a selected catalog food when absent.
 * Preferred may be null; optional may be omitted entirely.
 */

export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'ug' | 'IU';

export type NutrientRequirement = 'required' | 'preferred' | 'optional';

export interface NutrientSpec {
  id: string;
  unit: NutrientUnit;
  requirement: NutrientRequirement;
  displayName: string;
}

/** Catalog schema version this nutrient list belongs to. */
export const CATALOG_SCHEMA_VERSION = 1 as const;

export const NUTRIENT_SPECS: readonly NutrientSpec[] = [
  { id: 'energy_kcal', unit: 'kcal', requirement: 'required', displayName: 'Energy' },
  { id: 'protein', unit: 'g', requirement: 'required', displayName: 'Protein' },
  { id: 'carbohydrate', unit: 'g', requirement: 'required', displayName: 'Carbohydrate' },
  { id: 'fat_total', unit: 'g', requirement: 'required', displayName: 'Total fat' },
  { id: 'fiber', unit: 'g', requirement: 'preferred', displayName: 'Fiber' },
  { id: 'sugars_total', unit: 'g', requirement: 'preferred', displayName: 'Total sugars' },
  { id: 'fat_saturated', unit: 'g', requirement: 'preferred', displayName: 'Saturated fat' },
  { id: 'fat_monounsaturated', unit: 'g', requirement: 'optional', displayName: 'Monounsaturated fat' },
  { id: 'fat_polyunsaturated', unit: 'g', requirement: 'optional', displayName: 'Polyunsaturated fat' },
  { id: 'fat_trans', unit: 'g', requirement: 'optional', displayName: 'Trans fat' },
  { id: 'cholesterol', unit: 'mg', requirement: 'preferred', displayName: 'Cholesterol' },
  { id: 'sodium', unit: 'mg', requirement: 'preferred', displayName: 'Sodium' },
  { id: 'potassium', unit: 'mg', requirement: 'preferred', displayName: 'Potassium' },
  { id: 'calcium', unit: 'mg', requirement: 'preferred', displayName: 'Calcium' },
  { id: 'iron', unit: 'mg', requirement: 'preferred', displayName: 'Iron' },
  { id: 'magnesium', unit: 'mg', requirement: 'optional', displayName: 'Magnesium' },
  { id: 'phosphorus', unit: 'mg', requirement: 'optional', displayName: 'Phosphorus' },
  { id: 'zinc', unit: 'mg', requirement: 'optional', displayName: 'Zinc' },
  { id: 'vitamin_a_rae', unit: 'ug', requirement: 'optional', displayName: 'Vitamin A (RAE)' },
  { id: 'vitamin_c', unit: 'mg', requirement: 'optional', displayName: 'Vitamin C' },
  { id: 'vitamin_d', unit: 'ug', requirement: 'optional', displayName: 'Vitamin D' },
  { id: 'vitamin_e', unit: 'mg', requirement: 'optional', displayName: 'Vitamin E' },
  { id: 'vitamin_k', unit: 'ug', requirement: 'optional', displayName: 'Vitamin K' },
  { id: 'thiamin', unit: 'mg', requirement: 'optional', displayName: 'Thiamin' },
  { id: 'riboflavin', unit: 'mg', requirement: 'optional', displayName: 'Riboflavin' },
  { id: 'niacin', unit: 'mg', requirement: 'optional', displayName: 'Niacin' },
  { id: 'vitamin_b6', unit: 'mg', requirement: 'optional', displayName: 'Vitamin B6' },
  { id: 'folate_dfe', unit: 'ug', requirement: 'optional', displayName: 'Folate (DFE)' },
  { id: 'vitamin_b12', unit: 'ug', requirement: 'optional', displayName: 'Vitamin B12' },
  { id: 'water', unit: 'g', requirement: 'optional', displayName: 'Water' },
  { id: 'alcohol', unit: 'g', requirement: 'optional', displayName: 'Alcohol' },
] as const;

export const REQUIRED_NUTRIENT_IDS = NUTRIENT_SPECS.filter((n) => n.requirement === 'required').map(
  (n) => n.id,
);

export const PREFERRED_NUTRIENT_IDS = NUTRIENT_SPECS.filter((n) => n.requirement === 'preferred').map(
  (n) => n.id,
);

export const OPTIONAL_NUTRIENT_IDS = NUTRIENT_SPECS.filter((n) => n.requirement === 'optional').map(
  (n) => n.id,
);

export type NutrientId = (typeof NUTRIENT_SPECS)[number]['id'];
