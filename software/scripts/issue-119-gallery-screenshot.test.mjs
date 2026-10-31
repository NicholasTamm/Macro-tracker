import assert from 'node:assert/strict';
import test from 'node:test';
import { assertGalleryScreenshot } from './issue-119-gallery-screenshot.mjs';

const PALETTES = {
  light: [
    [255, 235, 229],
    [225, 242, 233],
    [255, 245, 225],
    [229, 238, 253],
    [255, 236, 225],
    [255, 139, 65],
  ],
  dark: [
    [58, 38, 31],
    [28, 45, 35],
    [58, 48, 27],
    [31, 41, 56],
    [67, 44, 29],
    [255, 139, 65],
  ],
};

const SWATCH_POSITIONS = [
  [24, 533],
  [88, 533],
  [146, 533],
  [206, 533],
  [266, 533],
  [322, 533],
];

function fillRect(image, color, left, top, width, height) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      image.rgb.set(color, (y * image.width + x) * 3);
    }
  }
}

function screenshot(scheme) {
  const rgb = new Uint8Array(430 * 1200 * 3);
  const image = { width: 430, height: 1200, rgb };
  for (const [index, color] of PALETTES[scheme].entries()) {
    fillRect(image, color, ...SWATCH_POSITIONS[index], 40, 40);
  }
  fillRect(image, [31, 27, 22], 40, 400, 20, 1);
  return image;
}

test('issue #119 gallery screenshot verifier accepts complete light and dark specimens', () => {
  assert.doesNotThrow(() => assertGalleryScreenshot(screenshot('light'), 'light'));
  assert.doesNotThrow(() => assertGalleryScreenshot(screenshot('dark'), 'dark'));
});

test('issue #119 gallery screenshot verifier rejects a clipped or wrong-theme swatch', () => {
  const image = screenshot('dark');
  fillRect(image, [0, 0, 0], ...SWATCH_POSITIONS[0], 40, 40);
  assert.throws(
    () => assertGalleryScreenshot(image, 'dark'),
    /dark illoProteinTint is missing, clipped, or rendered with the wrong tint/,
  );
});

test('issue #119 gallery screenshot verifier does not substitute brand pixels for mascot', () => {
  const image = screenshot('light');
  fillRect(image, [0, 0, 0], ...SWATCH_POSITIONS[5], 40, 40);
  fillRect(image, PALETTES.light[5], 20, 390, 100, 30);
  assert.throws(
    () => assertGalleryScreenshot(image, 'light'),
    /light mascot is missing, clipped, or rendered with the wrong tint/,
  );
});

test('issue #119 gallery screenshot verifier rejects a missing onBrand label', () => {
  const image = screenshot('light');
  fillRect(image, [0, 0, 0], 40, 400, 20, 1);
  assert.throws(
    () => assertGalleryScreenshot(image, 'light'),
    /light onBrand label is missing or rendered with the wrong color/,
  );
});
