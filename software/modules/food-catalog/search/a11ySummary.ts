/**
 * Accessibility result summary for Search (M1-12).
 * Spoken via accessibilityLiveRegion="polite".
 */

export function formatSearchA11ySummary(opts: {
  query: string;
  resultCount: number;
  browsing?: boolean;
}): string {
  const q = opts.query.trim();
  if (opts.browsing || !q) {
    return 'Browse Recent, Favorites, and My Foods';
  }
  if (opts.resultCount === 0) {
    return `No results for ${q}`;
  }
  if (opts.resultCount === 1) {
    return `1 result for ${q}`;
  }
  return `${opts.resultCount} results for ${q}`;
}
