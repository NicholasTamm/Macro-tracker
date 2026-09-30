import type { TextStyle } from 'react-native';

/**
 * Typography roles from styles.css product specimens
 * (.type-display / .type-metric / .type-section / .type-body / .type-caption,
 * food-row / banner / metric-value sizes).
 * System fonts stand in for Inter / display face until licensed fonts ship.
 */
export const Typography = {
  display: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  } satisfies TextStyle,
  metric: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
  } satisfies TextStyle,
  metricCompact: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  } satisfies TextStyle,
  section: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  } satisfies TextStyle,
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  } satisfies TextStyle,
  micro: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '500',
  } satisfies TextStyle,
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  } satisfies TextStyle,
} as const;

export type TypographyRole = keyof typeof Typography;
