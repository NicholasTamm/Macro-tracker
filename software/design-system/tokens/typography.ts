import type { TextStyle } from 'react-native';
import { Platform } from 'react-native';

/**
 * Typography roles from styles.css product specimens
 * (.type-display / .type-metric / .type-section / .type-body / .type-caption,
 * food-row / banner / metric-value sizes) — M1-32 / #81.
 *
 * Display face (MacroSans) is reserved for page-level labels.
 * Neutral UI face (system / Inter stack) covers dense product chrome.
 * Metrics are sized so system fallback and MacroSans share the same
 * line boxes — switching after load must not reflow.
 */

/** Bundled display face family name (matches @font-face MacroSans). */
export const FONT_DISPLAY = 'MacroSans';

/**
 * Neutral UI stack. On native we keep the platform default (no third-party
 * UI webfont yet); on web prefer Inter then system UI.
 */
export const FONT_UI = Platform.select({
  web: 'Inter, "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  default: undefined,
}) as string | undefined;

const uiFace = (style: TextStyle): TextStyle =>
  FONT_UI ? { ...style, fontFamily: FONT_UI } : style;

const displayFace = (style: TextStyle): TextStyle => ({
  ...style,
  fontFamily: FONT_DISPLAY,
});

export const Typography = {
  /** Large page labels (Dashboard / Strategy) — display face only. */
  display: displayFace({
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  } satisfies TextStyle),
  /** Alias for page chrome titles (same display range 28–34). */
  pageTitle: displayFace({
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  } satisfies TextStyle),
  metric: uiFace({
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
  } satisfies TextStyle),
  metricCompact: uiFace({
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  } satisfies TextStyle),
  section: uiFace({
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  } satisfies TextStyle),
  /** Controls / buttons 14–16 px. */
  control: uiFace({
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  } satisfies TextStyle),
  /** Dense food-row primary label. */
  foodName: uiFace({
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  } satisfies TextStyle),
  body: uiFace({
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  } satisfies TextStyle),
  bodyStrong: uiFace({
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  } satisfies TextStyle),
  caption: uiFace({
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  } satisfies TextStyle),
  /** 10–12 px metadata / chart axis. */
  metadata: uiFace({
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  } satisfies TextStyle),
  chartAxis: uiFace({
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  } satisfies TextStyle),
  micro: uiFace({
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '500',
  } satisfies TextStyle),
  /** @deprecated prefer `control` — kept for existing call sites. */
  button: uiFace({
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  } satisfies TextStyle),
} as const;

export type TypographyRole = keyof typeof Typography;

/** Roles that must use the display face. */
export const DISPLAY_ROLES = ['display', 'pageTitle'] as const;
