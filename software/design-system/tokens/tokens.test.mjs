import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

test('color tokens export light and dark palettes', () => {
  const src = readFileSync(join(dir, 'colors.ts'), 'utf8');
  assert.match(src, /export const lightPalette/);
  assert.match(src, /export const darkPalette/);
  assert.match(src, /ink:/);
  assert.match(src, /canvas:/);
});

test('spacing scale includes md and lg', () => {
  const src = readFileSync(join(dir, 'spacing.ts'), 'utf8');
  assert.match(src, /md:/);
  assert.match(src, /lg:/);
});
