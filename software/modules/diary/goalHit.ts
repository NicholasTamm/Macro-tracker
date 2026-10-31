import type { SqlExecutor } from '../app-core/user-data';

/**
 * Daily goal-hit rule (issue 125, owner-approved Oct 28 2026):
 * calories within ±10% of calorieGoal AND protein ≥ 90% of proteinGoal.
 * Both goals must exist and be positive; missing or non-finite totals never hit.
 */
export const CALORIE_TOLERANCE = 0.1;
export const PROTEIN_FLOOR = 0.9;

export type GoalHitTotals = {
  calories?: number | null;
  protein?: number | null;
} | null | undefined;

export type GoalHitGoals = {
  calorieGoal?: number | null;
  proteinGoal?: number | null;
} | null | undefined;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function isDailyGoalHit(totals: GoalHitTotals, goals: GoalHitGoals): boolean {
  const calorieGoal = goals?.calorieGoal;
  const proteinGoal = goals?.proteinGoal;
  const calories = totals?.calories;
  const protein = totals?.protein;
  if (!isPositive(calorieGoal) || !isPositive(proteinGoal)) return false;
  if (!isFiniteNumber(calories) || !isFiniteNumber(protein)) return false;
  const calorieMin = calorieGoal * (1 - CALORIE_TOLERANCE);
  const calorieMax = calorieGoal * (1 + CALORIE_TOLERANCE);
  const calorieRoundingError = Number.EPSILON * Math.max(1, Math.abs(calorieMax));
  const caloriesOk =
    calories >= calorieMin - calorieRoundingError && calories <= calorieMax + calorieRoundingError;
  const proteinFloor = proteinGoal * PROTEIN_FLOOR;
  const roundingError = Number.EPSILON * Math.max(1, Math.abs(proteinFloor));
  return caloriesOk && protein >= proteinFloor - roundingError;
}

/** The card shows only on the real current day, never for past or future days. */
export function shouldShowGoalHitCard(args: {
  viewDayKey: string;
  todayKey: string;
  hit: boolean;
}): boolean {
  return args.hit && args.viewDayKey === args.todayKey;
}

/** Haptic fires at most once per local day, tracked in app_setting. */
export function shouldFireGoalHitHaptic(args: {
  showCard: boolean;
  todayKey: string;
  lastCelebratedDay: string | null;
}): boolean {
  return args.showCard && args.lastCelebratedDay !== args.todayKey;
}

export const GOAL_HIT_CELEBRATED_KEY = 'goal_hit_celebrated_day';

export function getCelebratedGoalDay(db: SqlExecutor): string | null {
  const row = db.get<{ value: string }>('SELECT value FROM app_setting WHERE key = ?', [
    GOAL_HIT_CELEBRATED_KEY,
  ]);
  return typeof row?.value === 'string' && row.value.length > 0 ? row.value : null;
}

export function markGoalDayCelebrated(db: SqlExecutor, dayKey: string): void {
  db.run(
    `INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [GOAL_HIT_CELEBRATED_KEY, dayKey, new Date().toISOString()],
  );
}

/**
 * Claim today's celebration. Returns true exactly once per local day (the
 * caller then fires the haptic); later calls the same day return false.
 */
export function claimGoalHitCelebration(
  db: SqlExecutor,
  args: { viewDayKey: string; todayKey: string; hit: boolean },
): boolean {
  const showCard = shouldShowGoalHitCard(args);
  const fire = shouldFireGoalHitHaptic({
    showCard,
    todayKey: args.todayKey,
    lastCelebratedDay: getCelebratedGoalDay(db),
  });
  if (fire) markGoalDayCelebrated(db, args.todayKey);
  return fire;
}
