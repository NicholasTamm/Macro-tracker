/**
 * Search session: debounce + cancel over LocalFoodRepository (M1-12).
 * Does not open food detail / log sheet (M1-13).
 */
import type { LocalFoodRepository } from '../local-food-repo';
import { createDebouncedRunner, type DebouncedRunner } from './debounce';
import { enrichSearchHits, type EnrichedSearchResult } from './enrichHits';

export const DEFAULT_SEARCH_DEBOUNCE_MS = 200;

export type SearchControllerCallbacks = {
  onResults: (query: string, results: EnrichedSearchResult[]) => void;
  onBrowsing: () => void;
  onError?: (message: string) => void;
};

export type SearchController = {
  setQuery: (raw: string) => void;
  /** Clear query + cancel pending (Cancel button). */
  cancel: () => void;
  flushNow: (raw: string) => void;
  isPending: () => boolean;
  dispose: () => void;
};

export function createSearchController(
  repo: LocalFoodRepository,
  callbacks: SearchControllerCallbacks,
  opts: { debounceMs?: number; limit?: number } = {},
): SearchController {
  const debounceMs = opts.debounceMs ?? DEFAULT_SEARCH_DEBOUNCE_MS;
  const limit = opts.limit ?? 50;

  const runSearch = (generation: number, raw: string, runner: DebouncedRunner<[string]>) => {
    try {
      const hits = repo.search(raw, { limit });
      // Drop if cancelled while searching (sync today; still generation-guarded).
      if (generation !== runner.generation()) return;
      callbacks.onResults(raw, enrichSearchHits(repo, hits));
    } catch (e) {
      if (generation !== runner.generation()) return;
      callbacks.onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  // Runner closes over itself via lazy ref for generation checks inside fn.
  let runner!: DebouncedRunner<[string]>;
  runner = createDebouncedRunner<[string]>((generation, raw) => {
    runSearch(generation, raw, runner);
  }, { delayMs: debounceMs });

  return {
    setQuery(raw: string) {
      const trimmed = raw.trim();
      if (!trimmed) {
        runner.cancel();
        callbacks.onBrowsing();
        return;
      }
      runner.schedule(raw);
    },
    cancel() {
      runner.cancel();
      callbacks.onBrowsing();
    },
    flushNow(raw: string) {
      runner.cancel();
      const trimmed = raw.trim();
      if (!trimmed) {
        callbacks.onBrowsing();
        return;
      }
      // Use post-cancel generation for a fresh sync run.
      const gen = runner.generation();
      runSearch(gen, raw, runner);
    },
    isPending: () => runner.isPending(),
    dispose() {
      runner.cancel();
    },
  };
}
