import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';

const dir = dirname(fileURLToPath(import.meta.url));

async function loadColors() {
  const bundleDir = mkdtempSync(join(tmpdir(), 'macro-tracker-tokens-'));
  try {
    writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
    const source = readFileSync(join(dir, 'colors.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    writeFileSync(join(bundleDir, 'colors.js'), compiled.outputText);
    return await import(pathToFileURL(join(bundleDir, 'colors.js')).href);
  } finally {
    rmSync(bundleDir, { recursive: true, force: true });
  }
}

test('color tokens export light and dark palettes', () => {
  const src = readFileSync(join(dir, 'colors.ts'), 'utf8');
  assert.match(src, /export const lightPalette/);
  assert.match(src, /export const darkPalette/);
  assert.match(src, /ink:/);
  assert.match(src, /canvas:/);
  assert.match(src, /tile:/);
  assert.match(src, /overage:/);
  assert.match(src, /infoFill:/);
});

test('spacing scale includes md and lg', () => {
  const src = readFileSync(join(dir, 'spacing.ts'), 'utf8');
  assert.match(src, /md:/);
  assert.match(src, /lg:/);
});

test('surface hierarchy differs canvas/band/tile/control in both themes', async () => {
  const { lightPalette, darkPalette } = await loadColors();
  for (const [name, p] of [
    ['light', lightPalette],
    ['dark', darkPalette],
  ]) {
    const roles = [p.canvas, p.band, p.tile, p.control];
    assert.equal(p.tile, p.raised, `${name} tile aliases raised`);
    // At least three distinct surface values so screenshots can separate roles.
    assert.ok(new Set(roles).size >= 3, `${name} surface stack collapsed: ${roles}`);
    assert.notEqual(p.ink, p.muted, `${name} ink/muted must differ`);
    assert.notEqual(p.divider, p.canvas, `${name} divider distinct from canvas`);
  }
});

test('data-domain colors identical across light and dark', async () => {
  const { lightPalette, darkPalette, DATA_DOMAIN_KEYS } = await loadColors();
  for (const key of DATA_DOMAIN_KEYS) {
    assert.equal(
      lightPalette[key],
      darkPalette[key],
      `data-domain ${key} must be theme-stable`,
    );
  }
  assert.equal(lightPalette.overage, lightPalette.expenditure);
  assert.equal(darkPalette.overage, darkPalette.expenditure);
  assert.notEqual(lightPalette.overage, lightPalette.danger);
  assert.notEqual(darkPalette.overage, darkPalette.danger);
});

test('ErrorBanner and feature surfaces avoid raw hex outside tokens', () => {
  const banner = readFileSync(join(dir, '../components/ErrorBanner.tsx'), 'utf8');
  assert.doesNotMatch(banner, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(banner, /rgba?\(/);
  assert.match(banner, /colors\.infoFill/);
  assert.match(banner, /colors\.dangerFill/);
  assert.match(banner, /colors\.warningInk/);
  assert.match(banner, /colors\.overage|colors\.danger/);
});

function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('issue #119: illustration tokens exist in both palettes', async () => {
  const { lightPalette, darkPalette, ILLUSTRATION_KEYS } = await loadColors();
  assert.deepEqual([...ILLUSTRATION_KEYS], [
    'illoProteinTint',
    'illoCarbsTint',
    'illoFatTint',
    'illoEnergyTint',
    'mascotTint',
    'mascot',
  ]);
  for (const [name, p] of [
    ['light', lightPalette],
    ['dark', darkPalette],
  ]) {
    for (const key of ILLUSTRATION_KEYS) {
      assert.equal(typeof p[key], 'string', `${name}.${key} missing`);
      assert.ok(p[key].length > 0, `${name}.${key} empty`);
    }
    assert.equal(typeof p.onBrand, 'string', `${name}.onBrand missing`);
    assert.ok(p.onBrand.length > 0, `${name}.onBrand empty`);
    assert.equal(p.mascot, p.brand, `${name} mascot accent is brand orange`);
  }
  assert.equal(lightPalette.illoProteinTint, '#ffebe5');
  assert.equal(lightPalette.mascotTint, '#ffece1');
  assert.match(darkPalette.mascotTint, /^rgba\(/, 'dark tints are low-alpha');
});

test('issue #119: onBrand on brand meets WCAG AA (>= 4.5:1)', async () => {
  const { lightPalette, darkPalette } = await loadColors();
  for (const p of [lightPalette, darkPalette]) {
    const ratio = contrast(p.onBrand, p.brand);
    assert.ok(ratio >= 4.5, `onBrand/brand contrast ${ratio.toFixed(2)}`);
    assert.ok(contrast('#ffffff', p.brand) < 4.5, 'white on brand must stay disallowed');
  }
});

test('issue #119: illustration tokens do not change data-domain values', async () => {
  const { lightPalette } = await loadColors();
  assert.deepEqual(
    {
      energy: lightPalette.energy,
      protein: lightPalette.protein,
      fat: lightPalette.fat,
      carbs: lightPalette.carbs,
      expenditure: lightPalette.expenditure,
      weightTrend: lightPalette.weightTrend,
    },
    {
      energy: '#5b95f3',
      protein: '#ff825b',
      fat: '#ffc241',
      carbs: '#46ae74',
      expenditure: '#e98063',
      weightTrend: '#9b78d6',
    },
  );
});

test('issue #119: PrimaryButton brand variant uses onBrand on brand, never white', () => {
  const src = readFileSync(join(dir, '../components/PrimaryButton.tsx'), 'utf8');
  assert.match(src, /'brand'/);
  assert.match(src, /variant === 'brand'\s*\?\s*colors\.brand/);
  assert.match(src, /variant === 'brand'\s*\?\s*colors\.onBrand/);
  assert.doesNotMatch(src, /#fff|'white'/i);
});

test('issue #119: fence rule doc lists allowed and forbidden zones', () => {
  const doc = readFileSync(join(dir, '../../../docs/design/gentle-companion.md'), 'utf8');
  for (const word of ['onboarding', 'empty states', 'goal hit', 'MacroSummary', 'WeightChart', 'food detail', 'settings']) {
    assert.match(doc, new RegExp(word, 'i'), `fence doc mentions ${word}`);
  }
});
