import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), '..');

test('PrimaryButton enforces 44pt min height', () => {
  const src = readFileSync(join(componentsDir, 'PrimaryButton.tsx'), 'utf8');
  assert.match(src, /minHeight:\s*compact \? 44 : 44|minHeight:\s*44/);
  assert.match(src, /accessibilityLabel=\{label\}/);
  assert.match(src, /accessibilityRole="button"/);
});

test('FoodRow action control is 44×44', () => {
  const src = readFileSync(join(componentsDir, 'FoodRow.tsx'), 'utf8');
  assert.match(src, /width:\s*44/);
  assert.match(src, /height:\s*44/);
  assert.match(src, /accessibilityLabel=\{`\$\{actionLabel\}/);
});

test('ErrorBanner actions meet 44 min touch target', () => {
  const src = readFileSync(join(componentsDir, 'ErrorBanner.tsx'), 'utf8');
  assert.match(src, /minHeight:\s*44/);
  assert.match(src, /hitTarget/);
  assert.match(src, /accessibilityLabel="Dismiss"/);
});

test('Gallery scheme toggle has 44 min height and labels', () => {
  const src = readFileSync(join(componentsDir, '../Gallery.tsx'), 'utf8');
  assert.match(src, /minHeight:\s*44/);
  assert.match(src, /Color scheme:/);
});
