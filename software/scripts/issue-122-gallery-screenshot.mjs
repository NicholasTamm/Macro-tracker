import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { decodePng } from './issue-80-screenshot-parity.mjs';

const WIDTH = 430;
const HEIGHT = 3000;
const MASCOT_REGION_TOP = 1700;
const MASCOT_TINT = [255, 236, 225];
const THEMES = {
  light: { canvas: [249, 249, 249], raised: [255, 255, 255] },
  dark: { canvas: [20, 20, 20], raised: [37, 37, 37] },
};

function isColor(image, offset, expected) {
  return image.rgb[offset] === expected[0]
    && image.rgb[offset + 1] === expected[1]
    && image.rgb[offset + 2] === expected[2];
}

function countColor(image, expected, top = 0) {
  let count = 0;
  for (let y = top; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (isColor(image, (y * image.width + x) * 3, expected)) count += 1;
    }
  }
  return count;
}

function mascotComponents(image) {
  const seen = new Uint8Array(image.width * image.height);
  const components = [];
  for (let y = MASCOT_REGION_TOP; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const start = y * image.width + x;
      if (seen[start] || !isColor(image, start * 3, MASCOT_TINT)) continue;
      const stack = [start];
      seen[start] = 1;
      let size = 0;
      let left = x;
      let right = x;
      let top = y;
      let bottom = y;
      while (stack.length) {
        const pixel = stack.pop();
        const px = pixel % image.width;
        const py = Math.floor(pixel / image.width);
        size += 1;
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        for (const next of [pixel - 1, pixel + 1, pixel - image.width, pixel + image.width]) {
          const nx = next % image.width;
          if (
            next >= MASCOT_REGION_TOP * image.width
            && next < seen.length
            && Math.abs(nx - px) <= 1
            && !seen[next]
            && isColor(image, next * 3, MASCOT_TINT)
          ) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      if (size >= 1000) components.push({ size, left, right, top, bottom });
    }
  }
  return components;
}

export function assertMascotGalleryScreenshot(image, scheme) {
  assert.deepEqual([image.width, image.height], [WIDTH, HEIGHT], `${scheme} screenshot dimensions`);
  const theme = THEMES[scheme];
  assert.ok(theme, `unknown scheme ${scheme}`);
  assert.ok(countColor(image, theme.canvas, MASCOT_REGION_TOP) >= 50_000, `${scheme} canvas is missing`);
  assert.ok(countColor(image, theme.raised, MASCOT_REGION_TOP) >= 50_000, `${scheme} mascot cards are missing`);

  const components = mascotComponents(image);
  const galleryPoses = components.filter(({ size }) => size <= 2500);
  const emptyState = components.filter(({ size }) => size > 2500);
  assert.equal(galleryPoses.length, 6, `${scheme} gallery must render all six unclipped poses`);
  assert.equal(emptyState.length, 1, `${scheme} mascot empty state must render unclipped`);
  for (const component of components) {
    assert.ok(
      component.left > 0 && component.right < WIDTH - 1
        && component.top > MASCOT_REGION_TOP && component.bottom < HEIGHT - 1,
      `${scheme} mascot is clipped by the screenshot edge`,
    );
  }
}

function main(lightPath, darkPath) {
  assert.ok(lightPath && darkPath, 'usage: node issue-122-gallery-screenshot.mjs <light.png> <dark.png>');
  assertMascotGalleryScreenshot(decodePng(lightPath), 'light');
  assertMascotGalleryScreenshot(decodePng(darkPath), 'dark');
  console.log('OK: all six gallery poses and mascot empty state rendered unclipped in light and dark');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv[3]);
}
