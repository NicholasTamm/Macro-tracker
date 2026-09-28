/**
 * Spacing scale from styles.css --space-1..6 (4 / 8 / 12 / 16 / 24).
 * Extra xxl mirrors the UI plan's 32 step used in HANDOFF token notes.
 */
export const Spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space6: 24,
  /** Alias roles used by components */
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingKey = keyof typeof Spacing;
