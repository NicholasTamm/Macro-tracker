/**
 * Deterministic query normalization for LocalFoodRepository search.
 * Lowercase, strip diacritics-ish ASCII fold, collapse whitespace, drop
 * punctuation except hyphens (matches FTS tokenize = unicode61 tokenchars '-').
 */
export function normalizeQuery(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a normalized query into non-empty tokens. */
export function tokenizeQuery(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(/[\s-]+/).filter((t) => t.length > 0);
}

/**
 * Build an FTS5 MATCH expression with per-token prefixes (AND).
 * Short tokens (<2) are matched exact (prefix index starts at 2).
 */
export function buildFtsMatchExpression(normalized: string): string | null {
  const tokens = tokenizeQuery(normalized);
  if (tokens.length === 0) return null;
  return tokens
    .map((t) => {
      const safe = t.replace(/"/g, '');
      if (!safe) return null;
      if (safe.length < 2) return `"${safe}"`;
      return `"${safe}"*`;
    })
    .filter((x): x is string => Boolean(x))
    .join(' ');
}
