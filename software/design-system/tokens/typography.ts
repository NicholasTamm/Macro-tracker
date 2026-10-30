import type { TextStyle } from 'react-native';

/**
 * Typography roles from styles.css product specimens
 * (.type-display / .type-metric / .type-section / .type-body / .type-caption,
 * food-row / banner / metric-value sizes).
 *
 * Gentle companion (issue 120): UI text uses Figtree 400/500/600/700 and
 * display titles use Nunito 700/800, both OFL-1.1 via @expo-google-fonts.
 * `SystemTypography` is the render-before-load / load-failure fallback; the
 * branded `Typography` keeps the same sizes and fixed lineHeights so swapping
 * faces after load does not reflow. Numeric roles use tabular figures.
 */

type Weight = '400' | '500' | '600' | '700' | '800';

/** expo-google-fonts family names, one per weight (registered by useProductFonts). */
export const UI_FONT_FAMILIES: Record<Exclude<Weight, '800'>, string> = {
  '400': 'Figtree_400Regular',
  '500': 'Figtree_500Medium',
  '600': 'Figtree_600SemiBold',
  '700': 'Figtree_700Bold',
};

export const DISPLAY_FONT_FAMILIES: Record<'700' | '800', string> = {
  '700': 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
};

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export const SystemTypography = {
  /** Large page labels — display face (Nunito) once loaded. */
  display: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  /** Page chrome titles — display face. */
  pageTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  metric: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
    fontVariant: TABULAR,
  },
  metricCompact: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
    fontVariant: TABULAR,
  },
  section: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  /** Controls / buttons 14–16 px. */
  control: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  /** Dense food-row primary label. */
  foodName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  /** 10–12 px metadata. */
  metadata: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  chartAxis: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    fontVariant: TABULAR,
  },
  micro: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '500',
  },
  /** @deprecated prefer `control` — kept for existing call sites. */
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyRole = keyof typeof SystemTypography;
export type TypographyScale = Record<TypographyRole, TextStyle>;

/** Roles that must use the display face (Nunito). */
export const DISPLAY_ROLES = ['display', 'pageTitle'] as const;

/** Tabular-figure roles (digits must not shift neighbouring text). */
export const NUMERIC_ROLES = ['metric', 'metricCompact', 'chartAxis'] as const;

/**
 * Family for a weight once fonts are loaded. Custom faces carry their weight
 * in the family name, so branded styles drop `fontWeight` (Android would
 * otherwise synthesize bold on top of an already-bold face).
 */
export function uiFontFamily(weight: TextStyle['fontWeight']): string {
  const w = String(weight ?? '400');
  if (w === '800' || w === '900' || w === 'bold') return UI_FONT_FAMILIES['700'];
  return UI_FONT_FAMILIES[w as keyof typeof UI_FONT_FAMILIES] ?? UI_FONT_FAMILIES['400'];
}

export function displayFontFamily(weight: TextStyle['fontWeight']): string {
  return String(weight) === '800' ? DISPLAY_FONT_FAMILIES['800'] : DISPLAY_FONT_FAMILIES['700'];
}

function brand(role: TypographyRole, style: TextStyle): TextStyle {
  const { fontWeight, ...rest } = style;
  const isDisplay = (DISPLAY_ROLES as readonly string[]).includes(role);
  return {
    ...rest,
    fontFamily: isDisplay ? displayFontFamily(fontWeight) : uiFontFamily(fontWeight),
  };
}

/** Branded scale (Figtree UI, Nunito display). Use only after fonts load. */
export const Typography: TypographyScale = Object.fromEntries(
  (Object.keys(SystemTypography) as TypographyRole[]).map((role) => [
    role,
    brand(role, SystemTypography[role]),
  ]),
) as TypographyScale;

/** Pick the scale for the current font state — system until loaded or on failure. */
export function typographyFor(fontsLoaded: boolean): TypographyScale {
  return fontsLoaded ? Typography : SystemTypography;
}

/**
 * Weight override that stays on the product face: `{ fontWeight }` before
 * load, `{ fontFamily }` (Figtree at that weight) after. Use instead of a raw
 * `fontWeight` on any Text.
 */
export function weightStyle(
  weight: TextStyle['fontWeight'],
  fontsLoaded: boolean,
): Pick<TextStyle, 'fontWeight' | 'fontFamily'> {
  return fontsLoaded ? { fontFamily: uiFontFamily(weight) } : { fontWeight: weight };
}
