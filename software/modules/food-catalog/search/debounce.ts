/**
 * Debounced runner with generation-based cancel (M1-12).
 * New schedule() cancels the prior pending timer; cancel() drops pending
 * and invalidates in-flight callbacks so stale results are ignored.
 */

export type DebouncedRunnerOptions = {
  delayMs?: number;
  /** Injectable for tests. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
};

export type DebouncedRunner<TArgs extends unknown[]> = {
  /** Schedule a call; cancels any pending schedule. */
  schedule: (...args: TArgs) => void;
  /** Cancel pending work and bump generation so late callbacks no-op. */
  cancel: () => void;
  /** Current generation (increments on cancel / each schedule). */
  generation: () => number;
  /** Whether a timer is currently pending. */
  isPending: () => boolean;
};

export function createDebouncedRunner<TArgs extends unknown[]>(
  fn: (generation: number, ...args: TArgs) => void,
  opts: DebouncedRunnerOptions = {},
): DebouncedRunner<TArgs> {
  const delayMs = opts.delayMs ?? 200;
  const setTimer = opts.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id));

  let gen = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearPending = () => {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
  };

  return {
    schedule(...args: TArgs) {
      clearPending();
      const myGen = ++gen;
      timer = setTimer(() => {
        timer = null;
        if (myGen !== gen) return;
        fn(myGen, ...args);
      }, delayMs);
    },
    cancel() {
      clearPending();
      gen += 1;
    },
    generation: () => gen,
    isPending: () => timer != null,
  };
}
