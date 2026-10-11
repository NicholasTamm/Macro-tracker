/**
 * M1-31 / #80 — semantic color tokens, theme-stable data domains, no raw banner hex.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '..');
const bundleDir = join(__dirname, '.bundle-issue-80');

async function loadColors() {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const source = readFileSync(join(softwareRoot, 'design-system/tokens/colors.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(join(bundleDir, 'colors.js'), compiled.outputText);
  return import(pathToFileURL(join(bundleDir, 'colors.js')).href);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const p = join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

test('palette exposes surface + state + overage tokens', async () => {
  const { lightPalette, darkPalette, DATA_DOMAIN_KEYS } = await loadColors();
  for (const key of [
    'canvas', 'band', 'tile', 'raised', 'control', 'divider', 'ink', 'muted', 'faint',
    'infoFill', 'successFill', 'warningFill', 'dangerFill', 'warningInk', 'overage',
    'energy', 'protein', 'fat', 'carbs', 'expenditure', 'weightTrend', 'danger',
  ]) {
    assert.equal(typeof lightPalette[key], 'string', `light missing ${key}`);
    assert.equal(typeof darkPalette[key], 'string', `dark missing ${key}`);
  }
  for (const key of DATA_DOMAIN_KEYS) {
    assert.equal(lightPalette[key], darkPalette[key], key);
  }
  assert.notEqual(lightPalette.overage, lightPalette.danger);
});

test('ThemeProvider syncs StatusBar + SystemUI to canvas', () => {
  const src = readFileSync(
    join(softwareRoot, 'design-system/theme/ThemeProvider.tsx'),
    'utf8',
  );
  assert.match(src, /expo-status-bar/);
  assert.match(src, /expo-system-ui/);
  assert.match(src, /setBackgroundColorAsync\(theme\.colors\.canvas\)/);
  assert.match(src, /StatusBar/);
});

test('design-system components do not embed raw hex/rgba (tokens only)', () => {
  const root = join(softwareRoot, 'design-system/components');
  const offenders = [];
  for (const p of walk(root)) {
    if (!/\.(tsx|ts)$/.test(p)) continue;
    if (p.includes('__tests__')) continue;
    const source = readFileSync(p, 'utf8');
    if (/#[0-9a-fA-F]{3,8}/.test(source) || /rgba?\(/.test(source)) {
      offenders.push(p.replace(softwareRoot + '/', ''));
    }
  }
  assert.deepEqual(offenders, [], `raw colors in components: ${offenders.join(', ')}`);
});
