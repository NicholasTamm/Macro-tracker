import {
  coachingShellEnabled,
  type CoachingExclusionKey,
} from '../app-core/user-data/exclusions';

/** Coaching shell — TransparentTrend (M3). Empty in M1; gated by onboarding exclusions. */
export const CoachingModule = {
  name: 'coaching',
  status: 'shell' as const,
  enabledByDefault: false,
};

/**
 * M1-10: exclusions (or missing adult confirmation) disable coaching shell entry.
 * Stub OK — no estimator UI in M1.
 */
export function isCoachingShellEntryEnabled(input: {
  isAdultConfirmed: boolean;
  exclusions: readonly CoachingExclusionKey[];
}): boolean {
  return coachingShellEnabled(input);
}

export type { CoachingExclusionKey };
