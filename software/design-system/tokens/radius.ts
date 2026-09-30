/**
 * Radii from styles.css --radius-card (12) / --radius-panel (16),
 * plus pill / control radii used by buttons and chips in the HTML library.
 */
export const Radius = {
  sm: 8,
  card: 12,
  panel: 16,
  control: 7,
  pill: 999,
  sheet: 16,
} as const;

export type RadiusKey = keyof typeof Radius;
