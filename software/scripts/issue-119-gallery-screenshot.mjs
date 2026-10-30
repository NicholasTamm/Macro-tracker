import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { decodePng } from './issue-80-screenshot-parity.mjs';

const MIN_SWATCH_PIXELS = 700;
const MIN_LABEL_PIXELS = 20;

const LIGHT_COLORS = {
  illoProteinTint: [255, 235, 229],
  illoCarbsTint: [225, 242, 233],
  illoFatTint: [255, 245, 225],
  illoEnergyTint: [229, 238, 253],
  mascotTint: [255, 236, 225],
  mascot: [255, 139, 65],
};

const DARK_COLORS = {
  illoProteinTint: [58, 38, 31],
  illoCarbsTint: [28, 45, 35],
  illoFatTint: [58, 48, 27],
  illoEnergyTint: [31, 41, 56],
  mascotTint: [67, 44, 29],
  mascot: [255, 139, 65],
};

function countColor(image, expected, tolerance = 1) {
  let count = 0;
  for (let offset = 0; offset < image.rgb.length; offset += 3) {
    if (
      Math.abs(image.rgb[offset] - expected[0]) <= tolerance
      && Math.abs(image.rgb[offset + 1] - expected[1]) <= tolerance
      && Math.abs(image.rgb[offset + 2] - expected[2]) <= tolerance
    ) {
      count += 1;
    }
  }
  return count;
}

export function assertGalleryScreenshot(image, scheme) {
  assert.deepEqual([image.width, image.height], [430, 1200], `${scheme} screenshot dimensions`);
  const colors = scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  for (const [role, rgb] of Object.entries(colors)) {
    const count = countColor(image, rgb);
    assert.ok(
      count >= MIN_SWATCH_PIXELS,
      `${scheme} ${role} is missing, clipped, or rendered with the wrong tint (${count} pixels)`,
    );
  }
  const onBrandCount = countColor(image, [31, 27, 22], 2);
  assert.ok(
    onBrandCount >= MIN_LABEL_PIXELS,
    `${scheme} onBrand label is missing or rendered with the wrong color (${onBrandCount} pixels)`,
  );
}

function main(lightPath, darkPath) {
  assert.ok(lightPath && darkPath, 'usage: node issue-119-gallery-screenshot.mjs <light.png> <dark.png>');
  assertGalleryScreenshot(decodePng(lightPath), 'light');
  assertGalleryScreenshot(decodePng(darkPath), 'dark');
  console.log('OK: gallery brand button and all illustration swatches rendered unclipped in light and dark');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv[3]);
}
