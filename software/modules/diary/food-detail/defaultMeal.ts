import type { MealSlotRow } from '../../app-core/user-data/mealSlots';
import { localDayKeyFromDate, localTimeHHMM, parseLocalTimeHHMM } from '../dayKey';

/**
 * Choose the nearest default time within the local calendar day (no midnight
 * wrap); ties go to the later meal. Untimed slots are explicit choices only,
 * unless no timed slots exist, when the first slot is the fallback.
 */
export function defaultMealForLog(
  slots: readonly Pick<MealSlotRow, 'id' | 'defaultTime'>[],
  localDayKey: string,
  initialMealSlotId: string | null = null,
  now: Date = new Date(),
): { mealSlotId: string | null; timeText: string } {
  let selected = slots.find((slot) => slot.id === initialMealSlotId);
  if (!selected) {
    const minutes = now.getHours() * 60 + now.getMinutes();
    let nearestDistance = Infinity;
    let nearestMinutes = -1;
    for (const slot of slots) {
      const parsed = parseLocalTimeHHMM(slot.defaultTime ?? '');
      if (!parsed.ok) continue;
      const slotMinutes = parsed.hours * 60 + parsed.minutes;
      const distance = Math.abs(minutes - slotMinutes);
      if (distance < nearestDistance || (distance === nearestDistance && slotMinutes > nearestMinutes)) {
        selected = slot;
        nearestDistance = distance;
        nearestMinutes = slotMinutes;
      }
    }
    selected ??= slots[0];
  }
  return {
    mealSlotId: selected?.id ?? null,
    timeText: localDayKey === localDayKeyFromDate(now)
      ? localTimeHHMM(now)
      : selected?.defaultTime ?? localTimeHHMM(now),
  };
}
