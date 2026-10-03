import type { SqlExecutor } from './sqlExecutor';
import { newEntityId, nowIso } from './ids';
import { LOCAL_PROFILE_ID, type DailyTarget, type GoalKind, type UserGoal } from './profileTypes';
import type { StarterTarget } from './starterTarget';

function mapGoal(row: Record<string, unknown>): UserGoal {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    goalKind: row.goal_kind as GoalKind,
    rateKgPerWeek: row.rate_kg_per_week == null ? null : Number(row.rate_kg_per_week),
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    syncRevision: Number(row.sync_revision),
  };
}

function mapTarget(row: Record<string, unknown>): DailyTarget {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    energyKcal: Number(row.energy_kcal),
    proteinG: Number(row.protein_g),
    carbohydrateG: Number(row.carbohydrate_g),
    fatG: Number(row.fat_g),
    source: row.source as DailyTarget['source'],
    effectiveFrom: String(row.effective_from),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    syncRevision: Number(row.sync_revision),
  };
}

export function getActiveGoal(
  db: SqlExecutor,
  profileId: string = LOCAL_PROFILE_ID,
): UserGoal | null {
  const row = db.get(
    `SELECT * FROM user_goal WHERE profile_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
    [profileId],
  );
  return row ? mapGoal(row) : null;
}

export function setActiveGoal(
  db: SqlExecutor,
  input: { goalKind: GoalKind; rateKgPerWeek?: number | null },
  profileId: string = LOCAL_PROFILE_ID,
): UserGoal {
  const ts = nowIso();
  db.run(`UPDATE user_goal SET is_active = 0, updated_at = ? WHERE profile_id = ? AND is_active = 1`, [
    ts,
    profileId,
  ]);
  const id = newEntityId();
  const rate =
    input.goalKind === 'maintain' ? null : (input.rateKgPerWeek ?? (input.goalKind === 'lose' ? 0.5 : 0.25));
  db.run(
    `INSERT INTO user_goal (
      id, profile_id, goal_kind, rate_kg_per_week, is_active, created_at, updated_at, sync_revision
    ) VALUES (?, ?, ?, ?, 1, ?, ?, 0)`,
    [id, profileId, input.goalKind, rate, ts, ts],
  );
  const row = getActiveGoal(db, profileId);
  if (!row) throw new Error('setActiveGoal failed');
  return row;
}

export function getLatestTarget(
  db: SqlExecutor,
  profileId: string = LOCAL_PROFILE_ID,
): DailyTarget | null {
  const row = db.get(
    `SELECT * FROM daily_target WHERE profile_id = ? ORDER BY effective_from DESC, updated_at DESC LIMIT 1`,
    [profileId],
  );
  return row ? mapTarget(row) : null;
}

export function saveStarterTarget(
  db: SqlExecutor,
  target: StarterTarget,
  profileId: string = LOCAL_PROFILE_ID,
  effectiveFrom?: string,
): DailyTarget {
  const ts = nowIso();
  const id = newEntityId();
  const day = effectiveFrom ?? ts.slice(0, 10);
  db.run(
    `INSERT INTO daily_target (
      id, profile_id, energy_kcal, protein_g, carbohydrate_g, fat_g,
      source, effective_from, created_at, updated_at, sync_revision
    ) VALUES (?, ?, ?, ?, ?, ?, 'starter', ?, ?, ?, 0)`,
    [id, profileId, target.energyKcal, target.proteinG, target.carbohydrateG, target.fatG, day, ts, ts],
  );
  const row = getLatestTarget(db, profileId);
  if (!row) throw new Error('saveStarterTarget failed');
  return row;
}
