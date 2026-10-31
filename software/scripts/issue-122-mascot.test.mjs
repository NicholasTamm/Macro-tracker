import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');
const POSES = { wave: 'wave', think: 'think', cheer: 'cheer', sleep: 'sleep', scale: 'scale', emptyPlate: 'empty-plate' };

test('issue 122: Mascot maps all six poses to stable placeholder files', () => {
  const src = read('design-system/components/Mascot.tsx');
  const files = new Set(readdirSync(join(softwareRoot, 'assets/mascot')));
  for (const [pose, file] of Object.entries(POSES)) {
    assert.match(src, new RegExp(`\\b${pose}: require\\('../../assets/mascot/placeholder-${file}\\.svg'\\)`), pose);
    assert.ok(files.has(`placeholder-${file}.svg`), file);
  }
  assert.equal([...src.matchAll(/require\('..\/..\/assets\/mascot\//g)].length, 6, 'exactly six poses');
  assert.match(src, /from 'expo-image'/);
});

test('issue 122: placeholder art uses at most three flat colours, no outlines or raster', () => {
  const allowed = new Set(['#ffece1', '#ff8b41', '#1f1b16']);
  for (const file of Object.values(POSES)) {
    const svg = read(`assets/mascot/placeholder-${file}.svg`);
    assert.match(svg, /viewBox="0 0 120 120"/, `${file} square viewBox`);
    assert.doesNotMatch(svg, /stroke|<image|<text|data:/, `${file} flat, vector-only`);
    assert.ok((svg.match(/<circle /g) ?? []).length >= 3, `${file} built from circles`);
    const colours = new Set([...svg.matchAll(/#[0-9a-f]{6}/gi)].map(([hex]) => hex.toLowerCase()));
    assert.ok(colours.size <= 3, `${file} has ${colours.size} colours`);
    for (const hex of colours) assert.ok(allowed.has(hex), `${file} colour ${hex}`);
    assert.match(svg, /fill="#ffece1"/, `${file} mascotTint body`);
  }
});

test('issue 122: mascot is decorative and hidden from screen readers', () => {
  const src = read('design-system/components/Mascot.tsx');
  assert.match(src, /accessibilityElementsHidden/);
  assert.match(src, /importantForAccessibility="no-hide-descendants"/);
  assert.doesNotMatch(src, /accessibilityLabel/);
});

test('issue 122: EmptyState takes an illustration, keeps neutral default, CTA variant', () => {
  const src = read('design-system/components/EmptyState.tsx');
  assert.match(src, /illustration\?: React\.ReactNode/);
  assert.match(src, /mascotPose\?: MascotPose/);
  assert.match(src, /actionVariant = 'primary'/);
  assert.match(src, /variant=\{actionVariant\}/);
  assert.match(src, /illustration \?\?/);
  assert.match(src, /📋/, 'neutral default kept for unmigrated call sites');
});

test('issue 122: gallery shows every pose and a mascot empty state', () => {
  const g = read('design-system/Gallery.tsx');
  assert.match(g, /MASCOT_POSES\.map/);
  assert.match(g, /mascotPose="emptyPlate"/);
  assert.match(g, /actionVariant="brand"/);
  assert.match(read('assets/mascot/README.md'), /replaces them \*\*file for file\*\*/);
});
