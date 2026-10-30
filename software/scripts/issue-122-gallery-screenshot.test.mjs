import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMascotGalleryScreenshot } from './issue-122-gallery-screenshot.mjs';

const THEMES = {
  light: { canvas: [249, 249, 249], raised: [255, 255, 255] },
  dark: { canvas: [20, 20, 20], raised: [37, 37, 37] },
};
const TINT = [255, 236, 225];

function fillRect(image, color, left, top, width, height) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      image.rgb.set(color, (y * image.width + x) * 3);
    }
  }
}

function screenshot(scheme, poseCount = 6) {
  const image = { width: 430, height: 3000, rgb: new Uint8Array(430 * 3000 * 3) };
  fillRect(image, THEMES[scheme].canvas, 0, 0, image.width, image.height);
  fillRect(image, THEMES[scheme].raised, 10, 1750, 410, 1100);
  for (let index = 0; index < poseCount; index += 1) {
    fillRect(image, TINT, 30 + index * 60, 1800, 40, 40);
  }
  fillRect(image, TINT, 180, 2200, 60, 60);
  return image;
}

test('issue #122 gallery verifier accepts six poses and the empty state in both themes', () => {
  assert.doesNotThrow(() => assertMascotGalleryScreenshot(screenshot('light'), 'light'));
  assert.doesNotThrow(() => assertMascotGalleryScreenshot(screenshot('dark'), 'dark'));
});

test('issue #122 gallery verifier rejects a missing or clipped pose', () => {
  assert.throws(
    () => assertMascotGalleryScreenshot(screenshot('light', 5), 'light'),
    /light gallery must render all six unclipped poses/,
  );
});

test('issue #122 gallery verifier rejects the wrong theme presentation', () => {
  assert.throws(
    () => assertMascotGalleryScreenshot(screenshot('light'), 'dark'),
    /dark canvas is missing/,
  );
});
