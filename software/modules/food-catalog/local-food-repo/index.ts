export {
  LocalFoodRepository,
  type FoodRecord,
  type ServingRecord,
  type NutrientRecord,
  type SearchHit,
  type SearchMatchKind,
  type SearchOptions,
  type SeedMetadata,
} from './LocalFoodRepository';
export {
  openSeedBytes,
  wrapExpoSqliteSeed,
  wrapReadOnly,
  FIXTURE_SEED_RELATIVE_PATH,
  type OpenSeedOptions,
} from './openSeed';
export type { SqlExecutor, SqlRow } from './sqlTypes';
export {
  normalizeQuery,
  tokenizeQuery,
  buildFtsMatchExpression,
} from './normalizeQuery';
export { levenshtein, similarity, bestFuzzyScore } from './fuzzy';

/** Warm common-query p95 budget (lowest supported device target). */
export const WARM_COMMON_QUERY_P95_MS = 150;
