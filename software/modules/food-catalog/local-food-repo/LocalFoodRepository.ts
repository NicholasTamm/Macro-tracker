/**
 * LocalFoodRepository — read-only FoodSeed search (M1-09).
 *
 * Query stages (food-schema contract):
 * 1. Exact normalized name / alias
 * 2. FTS5 prefix + bm25 (name > aliases > category); LIKE fallback without FTS5
 * 3. Token intersection for multiword
 * 4. Fuzzy rerank of the top 50 (edit distance) — never full-table fuzzy scan
 * 5. Rank adjustments via alias.rank_boost
 *
 * Search UI lives in food-catalog/search + app/(tabs)/food-entry (M1-12).
 */
import { bestFuzzyScore } from './fuzzy';
import {
  buildFtsMatchExpression,
  normalizeQuery,
  tokenizeQuery,
} from './normalizeQuery';
import type { SqlExecutor } from './sqlTypes';

export type FoodRecord = {
  foodId: string;
  sourceId: string;
  externalId: string;
  dataType: string;
  description: string;
  normalizedName: string;
  category: string | null;
  defaultServingId: number | null;
};

export type ServingRecord = {
  servingId: number;
  sequence: number;
  quantity: number;
  unit: string;
  modifier: string | null;
  gramWeight: number;
  isDefault: boolean;
};

export type NutrientRecord = {
  nutrientId: string;
  amountPer100g: number;
  unit: string;
  displayName: string;
};

export type SearchMatchKind = 'exact' | 'fts' | 'fuzzy';

export type SearchHit = {
  foodId: string;
  description: string;
  normalizedName: string;
  category: string | null;
  sourceId: string;
  matchKind: SearchMatchKind;
  /** Higher is better after fuzzy blend / boosts. */
  score: number;
};

export type SearchOptions = {
  limit?: number;
  locale?: string;
  /** Skip fuzzy rerank (debug / budget probes). */
  skipFuzzy?: boolean;
};

export type SeedMetadata = {
  catalogSchemaVersion: string | null;
  seedVersion: string | null;
  foodCount: number;
  ftsAvailable: boolean;
};

type Candidate = {
  foodId: string;
  description: string;
  normalizedName: string;
  category: string | null;
  sourceId: string;
  matchKind: SearchMatchKind;
  /** Raw retrieval score (bm25 is negative → we negate; exact uses 1000). */
  baseScore: number;
  aliases: string[];
  rankBoost: number;
};

const BM25_NAME = 10.0;
const BM25_ALIASES = 5.0;
const BM25_CATEGORY = 1.0;
const EXACT_BASE = 1000;
const DEFAULT_LIMIT = 50;
const FUZZY_POOL = 50;

export class LocalFoodRepository {
  private ftsReady: boolean | null = null;

  constructor(private readonly db: SqlExecutor) {}

  /** Close the underlying executor (caller owns lifecycle). */
  close(): void {
    this.db.close();
  }

  getMetadata(): SeedMetadata {
    const schema = this.db.get<{ value: string }>(
      `SELECT value FROM catalog_metadata WHERE key = ?`,
      ['catalog_schema_version'],
    );
    const seed = this.db.get<{ value: string }>(
      `SELECT value FROM catalog_metadata WHERE key = ?`,
      ['seed_version'],
    );
    const countRow = this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM food`);
    return {
      catalogSchemaVersion: schema?.value ?? null,
      seedVersion: seed?.value ?? null,
      foodCount: Number(countRow?.c ?? 0),
      ftsAvailable: this.hasFts5(),
    };
  }

  getFood(foodId: string): FoodRecord | null {
    const row = this.db.get<{
      food_id: string;
      source_id: string;
      external_id: string;
      data_type: string;
      description: string;
      normalized_name: string;
      category: string | null;
      default_serving_id: number | null;
    }>(
      `SELECT food_id, source_id, external_id, data_type, description,
              normalized_name, category, default_serving_id
       FROM food WHERE food_id = ?`,
      [foodId],
    );
    if (!row) return null;
    return {
      foodId: row.food_id,
      sourceId: row.source_id,
      externalId: row.external_id,
      dataType: row.data_type,
      description: row.description,
      normalizedName: row.normalized_name,
      category: row.category,
      defaultServingId: row.default_serving_id,
    };
  }

  getServings(foodId: string): ServingRecord[] {
    const rows = this.db.all<{
      serving_id: number;
      sequence: number;
      quantity: number;
      unit: string;
      modifier: string | null;
      gram_weight: number;
      is_default: number;
    }>(
      `SELECT serving_id, sequence, quantity, unit, modifier, gram_weight, is_default
       FROM serving WHERE food_id = ? ORDER BY sequence ASC`,
      [foodId],
    );
    return rows.map((r) => ({
      servingId: r.serving_id,
      sequence: r.sequence,
      quantity: r.quantity,
      unit: r.unit,
      modifier: r.modifier,
      gramWeight: r.gram_weight,
      isDefault: r.is_default === 1,
    }));
  }

  getNutrients(foodId: string): NutrientRecord[] {
    const rows = this.db.all<{
      nutrient_id: string;
      amount_per_100g: number;
      canonical_unit: string;
      display_name: string;
    }>(
      `SELECT fn.nutrient_id, fn.amount_per_100g, nd.canonical_unit, nd.display_name
       FROM food_nutrient fn
       JOIN nutrient_definition nd ON nd.nutrient_id = fn.nutrient_id
       WHERE fn.food_id = ?
       ORDER BY nd.display_order ASC`,
      [foodId],
    );
    return rows.map((r) => ({
      nutrientId: r.nutrient_id,
      amountPer100g: r.amount_per_100g,
      unit: r.canonical_unit,
      displayName: r.display_name,
    }));
  }

  getSource(sourceId: string): { sourceId: string; displayName: string } | null {
    const row = this.db.get<{ source_id: string; display_name: string }>(
      `SELECT source_id, display_name FROM source WHERE source_id = ?`,
      [sourceId],
    );
    if (!row) return null;
    return { sourceId: row.source_id, displayName: row.display_name };
  }

  /**
   * Offline search: exact → FTS (or LIKE fallback) → fuzzy top-50 rerank.
   */

  search(rawQuery: string, opts: SearchOptions = {}): SearchHit[] {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, FUZZY_POOL);
    const locale = opts.locale ?? 'en';
    const normalized = normalizeQuery(rawQuery);
    if (!normalized) return [];

    const byId = new Map<string, Candidate>();

    for (const c of this.exactMatch(normalized, locale)) {
      byId.set(c.foodId, c);
    }

    for (const c of this.ftsOrFallback(normalized, limit)) {
      const existing = byId.get(c.foodId);
      if (!existing) {
        byId.set(c.foodId, c);
        continue;
      }
      if (existing.matchKind === 'exact') {
        // Keep exact primacy; still absorb aliases later.
        continue;
      }
      if (c.baseScore > existing.baseScore) byId.set(c.foodId, c);
    }

    // Token intersection: require every token to appear in name|aliases|category
    const tokens = tokenizeQuery(normalized);
    let candidates = [...byId.values()];
    if (tokens.length > 1) {
      const intersected = candidates.filter((c) => {
        const hay = `${c.normalizedName} ${c.aliases.join(' ')} ${c.category ?? ''}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
      // Only apply if we still have hits; otherwise keep retrieval set.
      if (intersected.length > 0) candidates = intersected;
    }

    this.attachAliasesAndBoosts(candidates, locale);

    if (!opts.skipFuzzy) {
      candidates = this.fuzzyRerank(candidates, normalized);
    } else {
      candidates.sort((a, b) => b.baseScore + b.rankBoost - (a.baseScore + a.rankBoost));
    }

    return candidates.slice(0, limit).map((c) => {
      const fuzzyBonus = (c as Candidate & { fuzzyBonus?: number }).fuzzyBonus ?? 0;
      return {
        foodId: c.foodId,
        description: c.description,
        normalizedName: c.normalizedName,
        category: c.category,
        sourceId: c.sourceId,
        matchKind: c.matchKind,
        score: c.baseScore + c.rankBoost + fuzzyBonus,
      };
    });
  }

  // --- internals -----------------------------------------------------------

  hasFts5(): boolean {
    if (this.ftsReady != null) return this.ftsReady;
    try {
      this.db.all(
        `SELECT food_id FROM food_fts WHERE food_fts MATCH ? LIMIT 1`,
        ['xyzzy_no_such_token'],
      );
      this.ftsReady = true;
    } catch {
      this.ftsReady = false;
    }
    return this.ftsReady;
  }

  private exactMatch(normalized: string, locale: string): Candidate[] {
    const rows = this.db.all<{
      food_id: string;
      description: string;
      normalized_name: string;
      category: string | null;
      source_id: string;
    }>(
      `SELECT f.food_id, f.description, f.normalized_name, f.category, f.source_id
       FROM food f
       WHERE f.normalized_name = ?
       UNION
       SELECT f.food_id, f.description, f.normalized_name, f.category, f.source_id
       FROM alias a
       JOIN food f ON f.food_id = a.food_id
       WHERE a.normalized_alias = ? AND a.locale = ?`,
      [normalized, normalized, locale],
    );
    return rows.map((r) => ({
      foodId: r.food_id,
      description: r.description,
      normalizedName: r.normalized_name,
      category: r.category,
      sourceId: r.source_id,
      matchKind: 'exact' as const,
      baseScore: EXACT_BASE,
      aliases: [],
      rankBoost: 0,
    }));
  }

  private ftsOrFallback(normalized: string, limit: number): Candidate[] {
    if (this.hasFts5()) {
      return this.ftsSearch(normalized, limit);
    }
    return this.likeFallbackSearch(normalized, limit);
  }

  private ftsSearch(normalized: string, limit: number): Candidate[] {
    const match = buildFtsMatchExpression(normalized);
    if (!match) return [];
    try {
      const rows = this.db.all<{
        food_id: string;
        description: string;
        normalized_name: string;
        category: string | null;
        source_id: string;
        rank: number;
      }>(
        `SELECT f.food_id, f.description, f.normalized_name, f.category, f.source_id,
                bm25(food_fts, ?, ?, ?) AS rank
         FROM food_fts
         JOIN food f ON f.food_id = food_fts.food_id
         WHERE food_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
        [BM25_NAME, BM25_ALIASES, BM25_CATEGORY, match, limit],
      );
      return rows.map((r) => ({
        foodId: r.food_id,
        description: r.description,
        normalizedName: r.normalized_name,
        category: r.category,
        sourceId: r.source_id,
        matchKind: 'fts' as const,
        // bm25 returns more-negative for better matches → invert
        baseScore: -Number(r.rank),
        aliases: [],
        rankBoost: 0,
      }));
    } catch {
      this.ftsReady = false;
      return this.likeFallbackSearch(normalized, limit);
    }
  }

  /**
   * sql.js / non-FTS5 double: token AND via LIKE on name + aliases + category.
   * Not identical to bm25, but preserves ranking-fixture intent on the fixture set.
   */
  private likeFallbackSearch(normalized: string, limit: number): Candidate[] {
    const tokens = tokenizeQuery(normalized);
    if (tokens.length === 0) return [];

    const rows = this.db.all<{
      food_id: string;
      description: string;
      normalized_name: string;
      category: string | null;
      source_id: string;
    }>(
      `SELECT food_id, description, normalized_name, category, source_id FROM food`,
    );

    const aliasRows = this.db.all<{ food_id: string; normalized_alias: string }>(
      `SELECT food_id, normalized_alias FROM alias`,
    );
    const aliasesByFood = new Map<string, string[]>();
    for (const a of aliasRows) {
      const list = aliasesByFood.get(a.food_id) ?? [];
      list.push(a.normalized_alias);
      aliasesByFood.set(a.food_id, list);
    }

    const scored: Candidate[] = [];
    for (const r of rows) {
      const aliases = aliasesByFood.get(r.food_id) ?? [];
      const hay = `${r.normalized_name} ${aliases.join(' ')} ${r.category ?? ''}`.toLowerCase();
      if (!tokens.every((t) => hay.includes(t))) continue;
      // Prefer name hits over alias-only over category-only.
      let score = 0;
      for (const t of tokens) {
        if (r.normalized_name.includes(t)) score += BM25_NAME;
        else if (aliases.some((a) => a.includes(t))) score += BM25_ALIASES;
        else if ((r.category ?? '').toLowerCase().includes(t)) score += BM25_CATEGORY;
      }
      scored.push({
        foodId: r.food_id,
        description: r.description,
        normalizedName: r.normalized_name,
        category: r.category,
        sourceId: r.source_id,
        matchKind: 'fts',
        baseScore: score,
        aliases,
        rankBoost: 0,
      });
    }
    scored.sort((a, b) => b.baseScore - a.baseScore);
    return scored.slice(0, limit);
  }

  private attachAliasesAndBoosts(candidates: Candidate[], locale: string): void {
    if (candidates.length === 0) return;
    const ids = candidates.map((c) => c.foodId);
    // sqlite bind limit — fixture is tiny; chunk if needed later
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.all<{
      food_id: string;
      normalized_alias: string;
      rank_boost: number;
    }>(
      `SELECT food_id, normalized_alias, rank_boost FROM alias
       WHERE locale = ? AND food_id IN (${placeholders})`,
      [locale, ...ids],
    );
    const byFood = new Map<string, { aliases: string[]; boost: number }>();
    for (const r of rows) {
      const cur = byFood.get(r.food_id) ?? { aliases: [], boost: 0 };
      cur.aliases.push(r.normalized_alias);
      cur.boost = Math.max(cur.boost, Number(r.rank_boost) || 0);
      byFood.set(r.food_id, cur);
    }
    for (const c of candidates) {
      const info = byFood.get(c.foodId);
      if (!info) continue;
      c.aliases = info.aliases;
      c.rankBoost = info.boost;
    }
  }

  private fuzzyRerank(candidates: Candidate[], normalized: string): Candidate[] {
    const pool = candidates.slice(0, FUZZY_POOL);
    const enriched = pool.map((c) => {
      const fuzzy = bestFuzzyScore(normalized, c.normalizedName, c.aliases);
      const fuzzyBonus = fuzzy * 50; // blend with baseScore / boosts
      return Object.assign(c, {
        fuzzyBonus,
        matchKind:
          fuzzy >= 0.9 && c.matchKind !== 'exact'
            ? ('fuzzy' as SearchMatchKind)
            : c.matchKind,
        total: c.baseScore + c.rankBoost + fuzzyBonus,
      });
    });
    enriched.sort((a, b) => b.total - a.total);
    return enriched;
  }
}
