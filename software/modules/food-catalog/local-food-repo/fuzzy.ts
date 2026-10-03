/**
 * Edit-distance helpers for fuzzy rerank of the FTS/exact top-50
 * (never full-table fuzzy scan — see food-schema contract).
 */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = b.length + 1;
  let prev = new Array<number>(rows);
  let cur = new Array<number>(rows);
  for (let j = 0; j < rows; j++) prev[j] = j;
  for (let i = 0; i < a.length; i++) {
    cur[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur[j + 1] = Math.min(cur[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}

/** Similarity in [0, 1]; 1 = identical. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Best similarity of `query` against a primary name and optional alias list.
 * Also scores token-level best match for multiword queries.
 */
export function bestFuzzyScore(
  query: string,
  name: string,
  aliases: string[] = [],
): number {
  let best = similarity(query, name);
  for (const alias of aliases) {
    best = Math.max(best, similarity(query, alias));
  }
  // Prefix-friendly: if query is a prefix of name/alias, boost.
  if (name.startsWith(query) || aliases.some((a) => a.startsWith(query))) {
    best = Math.max(best, 0.85);
  }
  return best;
}
