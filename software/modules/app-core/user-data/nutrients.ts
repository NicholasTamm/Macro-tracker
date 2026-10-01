/**
 * Nutrient map helpers — NULL/missing ≠ numeric zero.
 * Serialized as JSON object; omitted keys or explicit null mean unavailable.
 */

export type NutrientMap = Record<string, number | null>;

export function serializeNutrients(map: NutrientMap): string {
  // Preserve nulls; never coerce undefined→0
  const out: NutrientMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined) continue;
    out[k] = v === null ? null : Number(v);
  }
  return JSON.stringify(out);
}

export function parseNutrients(json: string): NutrientMap {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const out: NutrientMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null) {
      out[k] = null;
    } else if (typeof v === 'number' && !Number.isNaN(v)) {
      out[k] = v;
    } else {
      throw new Error(`Invalid nutrient value for ${k}: ${String(v)}`);
    }
  }
  return out;
}

/** True when key is present and explicitly zero (not missing). */
export function isExplicitZero(map: NutrientMap, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key) && map[key] === 0;
}

export function isMissing(map: NutrientMap, key: string): boolean {
  return !Object.prototype.hasOwnProperty.call(map, key) || map[key] === null;
}
