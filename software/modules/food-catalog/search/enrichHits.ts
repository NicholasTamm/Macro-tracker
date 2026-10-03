/**
 * Enrich LocalFoodRepository SearchHit rows with source label + per-100 g macros.
 */
import type { LocalFoodRepository, SearchHit } from '../local-food-repo';
import {
  formatResultDetail,
  macrosFromNutrientRows,
  type MacroPer100g,
} from './formatResultDetail';

export type EnrichedSearchResult = {
  foodId: string;
  name: string;
  sourceId: string;
  sourceLabel: string;
  /** FoodRow detail: source · macros · per 100 g */
  detail: string;
  matchKind: SearchHit['matchKind'];
  score: number;
  macros: MacroPer100g;
  category: string | null;
};

export function enrichSearchHit(
  repo: LocalFoodRepository,
  hit: SearchHit,
): EnrichedSearchResult {
  const source = repo.getSource(hit.sourceId);
  const sourceLabel = source?.displayName ?? hit.sourceId;
  const nutrients = repo.getNutrients(hit.foodId);
  const macros = macrosFromNutrientRows(nutrients);
  return {
    foodId: hit.foodId,
    name: hit.description,
    sourceId: hit.sourceId,
    sourceLabel,
    detail: formatResultDetail(sourceLabel, macros),
    matchKind: hit.matchKind,
    score: hit.score,
    macros,
    category: hit.category,
  };
}

export function enrichSearchHits(
  repo: LocalFoodRepository,
  hits: SearchHit[],
): EnrichedSearchResult[] {
  return hits.map((h) => enrichSearchHit(repo, h));
}
