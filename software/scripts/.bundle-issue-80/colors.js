/**
 * Semantic color tokens ported from
 * macrofactor-codex-research/design-system/styles.css (--app-*, nutrient roles).
 * Feature modules must use these names — no raw hex outside design-system/.
 */
/** Fixed light values from --app-light-* and nutrient roles in styles.css */
export const lightPalette = {
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
};
/** Dark theme remaps --app-* to --app-dark-* (nutrient / data roles stay shared). */
export const darkPalette = {
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
};
export function paletteFor(scheme) {
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
];
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
};
