import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const dir = dirname(fileURLToPath(import.meta.url));
const bundleDir = join(dir, '.bundle-tokens');

async function loadColors() {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const source = readFileSync(join(dir, 'colors.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(join(bundleDir, 'colors.js'), compiled.outputText);
  return import(pathToFileURL(join(bundleDir, 'colors.js')).href);
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
