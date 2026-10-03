/** Coaching-disabling exclusion keys collected during onboarding. */
export const COACHING_EXCLUSION_KEYS = [
  'pregnancy',
  'lactation',
  'eating_disorder_history',
  'under_clinical_care',
  'clinician_advised_against',
] as const;

export type CoachingExclusionKey = (typeof COACHING_EXCLUSION_KEYS)[number];

export function parseExclusionsJson(raw: string): CoachingExclusionKey[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('exclusions_json is not valid JSON');
  }
  if (!Array.isArray(parsed)) throw new Error('exclusions_json must be an array');
  const out: CoachingExclusionKey[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string') throw new Error('exclusion entries must be strings');
    if ((COACHING_EXCLUSION_KEYS as readonly string[]).includes(item)) {
      out.push(item as CoachingExclusionKey);
    }
  }
  return out;
}

export function serializeExclusions(keys: readonly CoachingExclusionKey[]): string {
  const unique = [...new Set(keys)];
  return JSON.stringify(unique);
}

/** Any listed exclusion (or missing adult confirmation) disables the coaching shell. */
export function coachingShellEnabled(input: {
  isAdultConfirmed: boolean;
  exclusions: readonly CoachingExclusionKey[];
}): boolean {
  if (!input.isAdultConfirmed) return false;
  return input.exclusions.length === 0;
}
