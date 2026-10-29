/**
 * Semantic color tokens ported from
 * macrofactor-codex-research/design-system/styles.css (--app-*, nutrient roles).
 * Feature modules must use these names — no raw hex outside design-system/.
 */

export type ColorSchemeName = 'light' | 'dark';

export type AppPalette = {
  /** Page background (charcoal stack in dark). */
  canvas: string;
  /** Grouped band / section chrome. */
  band: string;
  /** Raised tile / card surface. */
  raised: string;
  /** Alias of raised — gallery "tile" role. */
  tile: string;
  /** Controls, chips, segmented tracks. */
  control: string;
  divider: string;
  controlBorder: string;
  ink: string;
  muted: string;
  /** Extra-faint chrome (disabled / tertiary). */
  faint: string;
  overlayStage: string;
  scrim: string;
  educationInk: string;
  brand: string;
  /** Errors + destructive actions only — never nutrition overage. */
  danger: string;
  /** Stable data-domain series (identical across themes). */
  energy: string;
  protein: string;
  fat: string;
  carbs: string;
  expenditure: string;
  weightTrend: string;
  education: string;
  /** Banner / state fills (composited over canvas for contrast). */
  infoFill: string;
  successFill: string;
  warningFill: string;
  dangerFill: string;
  warningInk: string;
  /**
   * Nutrition overage / surplus cue — deliberately NOT danger red.
   * Uses expenditure coral so overage stays in the data-domain family.
   */
  overage: string;
  /**
   * Gentle companion illustration roles (issue #119). Art-only fills for
   * onboarding, empty states and goal-hit moments — never inside the data zone
   * (numbers, rings, charts). See docs/design/gentle-companion.md.
   */
  illoProteinTint: string;
  illoCarbsTint: string;
  illoFatTint: string;
  illoEnergyTint: string;
  /** Mascot body fill. */
  mascotTint: string;
  /** Mascot accent (cheeks) — same value as brand orange. */
  mascot: string;
  /** Ink for text/icons on a brand-orange fill (white on #ff8b41 fails contrast). */
  onBrand: string;
};

/** Fixed light values from --app-light-* and nutrient roles in styles.css */
export const lightPalette: AppPalette = {
  canvas: '#f9f9f9',
  band: '#f1f1f1',
  raised: '#ffffff',
  tile: '#ffffff',
  control: '#ececec',
  divider: '#e5e5e5',
  controlBorder: '#8a8a8a',
  ink: '#080808',
  // M1-21: darkened from #777777 (4.25:1 on canvas) to meet WCAG AA 4.5:1 on canvas/band/control.
  muted: '#6b6b6b',
  faint: '#a6a6ab',
  overlayStage: '#202020',
  scrim: 'rgba(5,5,7,0.68)',
  educationInk: '#2e2140',
  brand: '#ff8b41',
  // M1-21: darkened from #df4c4c (3.37:1 on control) — destructive labels are text.
  danger: '#b83232',
  energy: '#5b95f3',
  protein: '#ff825b',
  fat: '#ffc241',
  carbs: '#46ae74',
  expenditure: '#e98063',
  weightTrend: '#9b78d6',
  education: '#ebdcff',
  infoFill: 'rgba(91,149,243,0.12)',
  successFill: 'rgba(70,174,116,0.12)',
  warningFill: 'rgba(255,194,65,0.17)',
  dangerFill: 'rgba(223,76,76,0.12)',
  warningInk: '#a66d00',
  overage: '#e98063',
  illoProteinTint: '#ffebe5',
  illoCarbsTint: '#e1f2e9',
  illoFatTint: '#fff5e1',
  illoEnergyTint: '#e5eefd',
  mascotTint: '#ffece1',
  mascot: '#ff8b41',
  onBrand: '#1f1b16',
};

/** Dark theme remaps --app-* to --app-dark-* (nutrient / data roles stay shared). */
export const darkPalette: AppPalette = {
  ...lightPalette,
  canvas: '#141414',
  band: '#1f1f1f',
  raised: '#252525',
  tile: '#252525',
  control: '#383838',
  divider: '#3a3a3c',
  controlBorder: '#777777',
  ink: '#f6f6f3',
  // M1-21: lightened from #9a9a9a (4.17:1 on control).
  muted: '#a8a8a8',
  faint: '#747479',
  // M1-21: dark-only danger (light #b83232 is ~2:1 on dark control).
  danger: '#ff8080',
  overlayStage: '#141414',
  warningInk: '#ffc241',
  // Low-alpha tints so illustrations sit quietly on #141414 / #252525.
  illoProteinTint: 'rgba(255,130,91,0.16)',
  illoCarbsTint: 'rgba(70,174,116,0.16)',
  illoFatTint: 'rgba(255,194,65,0.16)',
  illoEnergyTint: 'rgba(91,149,243,0.16)',
  mascotTint: 'rgba(255,139,65,0.2)',
};

export function paletteFor(scheme: ColorSchemeName): AppPalette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}

/** Stable data-domain keys — must match across light/dark (issue #80 AC). */
export const DATA_DOMAIN_KEYS = [
  'energy',
  'protein',
  'fat',
  'carbs',
  'expenditure',
  'weightTrend',
] as const;

/** Gentle companion illustration keys (issue #119) — art only, never data zone. */
export const ILLUSTRATION_KEYS = [
  'illoProteinTint',
  'illoCarbsTint',
  'illoFatTint',
  'illoEnergyTint',
  'mascotTint',
  'mascot',
  'onBrand',
] as const;

/** CSS custom-property → token mapping (documentation for audits). */
export const cssTokenMap = {
  '--app-canvas': 'palette.canvas',
  '--app-band': 'palette.band',
  '--app-raised': 'palette.raised / palette.tile',
  '--app-control': 'palette.control',
  '--app-divider': 'palette.divider',
  '--app-control-border': 'palette.controlBorder',
  '--app-ink': 'palette.ink',
  '--app-muted': 'palette.muted',
  '--app-scrim': 'palette.scrim',
  '--app-education-ink': 'palette.educationInk',
  '--marketing-accent / --brand': 'palette.brand',
  '--energy': 'palette.energy',
  '--protein': 'palette.protein',
  '--fat': 'palette.fat',
  '--carbs': 'palette.carbs',
  '--expenditure': 'palette.expenditure / palette.overage',
  '--weight-trend': 'palette.weightTrend',
  '--education': 'palette.education',
  '--danger': 'palette.danger',
} as const;
