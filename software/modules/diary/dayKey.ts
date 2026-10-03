/**
 * Local calendar day keys (yyyy-MM-dd) for diary Today navigation.
 * Independent of meal_slot_id — day keys come from wall-clock local date.
 */

export function localDayKeyFromDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDayKey(localDayKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDayKey);
  if (!m) throw new Error(`Invalid localDayKey: ${localDayKey}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function shiftDayKey(localDayKey: string, deltaDays: number): string {
  const dt = parseDayKey(localDayKey);
  dt.setDate(dt.getDate() + deltaDays);
  return localDayKeyFromDate(dt);
}

export function formatDayLabel(localDayKey: string, todayKey: string = localDayKeyFromDate()): string {
  if (localDayKey === todayKey) return 'Today';
  if (localDayKey === shiftDayKey(todayKey, -1)) return 'Yesterday';
  if (localDayKey === shiftDayKey(todayKey, 1)) return 'Tomorrow';
  return parseDayKey(localDayKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Format an ISO timestamp for a diary row (time only, locale-aware). */
export function formatEntryTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return isoTimestamp;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
