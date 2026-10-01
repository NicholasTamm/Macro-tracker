import type { SqlExecutor } from './sqlExecutor';
import { newEntityId } from './ids';

const DEFAULT_SLOTS = [
  { name: 'Breakfast', sortOrder: 0, defaultTime: '08:00' },
  { name: 'Lunch', sortOrder: 1, defaultTime: '12:30' },
  { name: 'Dinner', sortOrder: 2, defaultTime: '18:30' },
  { name: 'Snacks', sortOrder: 3, defaultTime: null as string | null },
];

export function ensureDefaultMealSlots(db: SqlExecutor): void {
  const count = db.get<{ c: number }>('SELECT COUNT(*) as c FROM meal_slot');
  if (count && Number(count.c) > 0) return;
  for (const slot of DEFAULT_SLOTS) {
    db.run(
      `INSERT INTO meal_slot (id, name, sort_order, default_time, is_archived) VALUES (?, ?, ?, ?, 0)`,
      [newEntityId(), slot.name, slot.sortOrder, slot.defaultTime],
    );
  }
}

export function listMealSlots(db: SqlExecutor): Array<{ id: string; name: string; sortOrder: number }> {
  return db.all<{ id: string; name: string; sort_order: number }>(
    `SELECT id, name, sort_order FROM meal_slot WHERE is_archived = 0 ORDER BY sort_order`,
  ).map((r) => ({ id: String(r.id), name: String(r.name), sortOrder: Number(r.sort_order) }));
}
