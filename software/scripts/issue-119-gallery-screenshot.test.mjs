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

function screenshot(scheme) {
  const rgb = new Uint8Array(430 * 1200 * 3);
  let pixel = 0;
  for (const color of PALETTES[scheme]) {
    for (let count = 0; count < 700; count += 1, pixel += 1) {
      rgb.set(color, pixel * 3);
    }
  }
  for (let count = 0; count < 20; count += 1, pixel += 1) {
    rgb.set([31, 27, 22], pixel * 3);
  }
  return { width: 430, height: 1200, rgb };
}

test('issue #119 gallery screenshot verifier accepts complete light and dark specimens', () => {
  assert.doesNotThrow(() => assertGalleryScreenshot(screenshot('light'), 'light'));
  assert.doesNotThrow(() => assertGalleryScreenshot(screenshot('dark'), 'dark'));
});

test('issue #119 gallery screenshot verifier rejects a clipped or wrong-theme swatch', () => {
  const image = screenshot('dark');
  image.rgb.fill(0, 0, 700 * 3);
  assert.throws(
    () => assertGalleryScreenshot(image, 'dark'),
    /dark illoProteinTint is missing, clipped, or rendered with the wrong tint/,
  );
});

test('issue #119 gallery screenshot verifier rejects a missing onBrand label', () => {
  const image = screenshot('light');
  image.rgb.fill(0, 6 * 700 * 3, (6 * 700 + 20) * 3);
  assert.throws(
    () => assertGalleryScreenshot(image, 'light'),
    /light onBrand label is missing or rendered with the wrong color/,
  );
});
