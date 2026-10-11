/**
 * M1-32 / #81 — compact product typography + MacroSans load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '..');

test('MacroSans font asset is bundled offline', () => {
  const font = join(softwareRoot, 'assets/fonts/MacroSans-VF.ttf');
  assert.ok(existsSync(font), 'MacroSans-VF.ttf missing');
  const bytes = readFileSync(font);
  assert.ok(bytes.length > 50_000, 'font asset looks truncated');
});

test('font loader maps MacroSans via expo-font', () => {
  const src = readFileSync(
    join(softwareRoot, 'design-system/fonts/loadProductFonts.ts'),
    'utf8',
  );
  assert.match(src, /expo-font/);
  assert.match(src, /MacroSans-VF\.ttf/);
  assert.match(src, /FONT_DISPLAY/);
  assert.match(src, /useProductFonts/);
});

test('root layout starts font load without blocking splash', () => {
  const src = readFileSync(join(softwareRoot, 'app/_layout.tsx'), 'utf8');
  assert.match(src, /useProductFonts/);
  assert.doesNotMatch(src, /if\s*\(\s*!fontsLoaded/);
});

test('FoodRow uses foodName + metadata roles', () => {
  const src = readFileSync(
    join(softwareRoot, 'design-system/components/FoodRow.tsx'),
    'utf8',
  );
  assert.match(src, /typography\.foodName/);
  assert.match(src, /typography\.metadata/);
});

test('typography roles document measured size bands', () => {
  const src = readFileSync(
    join(softwareRoot, 'design-system/tokens/typography.ts'),
    'utf8',
  );
  assert.match(src, /fontSize: 32/); // display 28–34
  assert.match(src, /fontSize: 28/); // metric / pageTitle
  assert.match(src, /fontSize: 18/); // section 17–20
  assert.match(src, /fontSize: 15/); // control/body 14–16
  assert.match(src, /fontSize: 13/); // food name
  assert.match(src, /fontSize: 10/); // metadata / chart axis 10–12
});
