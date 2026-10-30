import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

function decodePng(path) {
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString(), 'PNG', `${path}: not a PNG`);
  let offset = 8;
  let width;
  let height;
  let colorType;
  const chunks = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString();
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, `${path}: expected 8-bit PNG`);
      colorType = data[9];
      assert.equal(data[12], 0, `${path}: interlaced PNG unsupported`);
    } else if (type === 'IDAT') {
      chunks.push(data);
    }
    offset += length + 12;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  assert.ok(channels, `${path}: unsupported PNG color type ${colorType}`);
  const packed = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[source++];
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[source++];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const dl = Math.abs(estimate - left);
        const du = Math.abs(estimate - up);
        const dul = Math.abs(estimate - upLeft);
        value = raw + (dl <= du && dl <= dul ? left : du <= dul ? up : upLeft);
      } else throw new Error(`${path}: unknown PNG filter ${filter}`);
      pixels[y * stride + x] = value & 255;
    }
  }
  const luma = new Float64Array(width * height);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    const p = i * channels;
    rgb[i * 3] = pixels[p];
    rgb[i * 3 + 1] = pixels[p + 1];
    rgb[i * 3 + 2] = pixels[p + 2];
    luma[i] = 0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2];
  }
  return { width, height, luma, rgb };
}

function stats(image) {
  let sum = 0;
  for (const value of image.luma) sum += value;
  const mean = sum / image.luma.length;
  let squared = 0;
  for (const value of image.luma) squared += (value - mean) ** 2;
  return { mean, deviation: Math.sqrt(squared / image.luma.length) };
}

function rowEdgeProfile(image) {
  const profile = new Float64Array(image.height);
  for (let y = 1; y < image.height; y += 1) {
    let edges = 0;
    for (let x = 1; x < image.width; x += 2) {
      const i = y * image.width + x;
      edges += Math.abs(image.luma[i] - image.luma[i - 1]);
      edges += Math.abs(image.luma[i] - image.luma[i - image.width]);
    }
    profile[y] = edges / image.width;
  }
  return profile;
}

function correlation(a, b) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let squareA = 0;
  let squareB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    squareA += da * da;
    squareB += db * db;
  }
  return numerator / Math.sqrt(squareA * squareB);
}

const ROLE_TOLERANCE = { muted: 16 };

function roleSamplePoints(target, width) {
  if (target === 'app') {
    return {
      canvas: [210, 381],
      band: [width - 5, 30],
      tile: [Math.floor(width / 2), 450],
      control: [32, 10],
      divider: [Math.floor(width / 2), 782],
      ink: [92, 293],
      muted: [203, 146],
    };
  }
  const mobileHeroOffset = width === 430 ? 52 : 0;
  return {
    canvas: [70, 900 - mobileHeroOffset],
    band: [Math.floor(width / 2), 1070 - mobileHeroOffset],
    tile: [width - 130, 1152 - mobileHeroOffset],
    control: [Math.floor(width / 2) + 45, 1015 - mobileHeroOffset],
    divider: [100, 764 - mobileHeroOffset],
    ink: [100, 454],
    muted: [Math.floor(width / 2) + 40, 1024 - mobileHeroOffset],
  };
}

function sampleRgb(image, [x, y]) {
  assert.ok(
    x >= 0 && x < image.width && y >= 0 && y < image.height,
    `sample out of bounds: ${x},${y}`,
  );
  const offset = (y * image.width + x) * 3;
  return Array.from(image.rgb.subarray(offset, offset + 3));
}

function sampleLuma(image, [x, y]) {
  assert.ok(
    x >= 0 && x < image.width && y >= 0 && y < image.height,
    `sample out of bounds: ${x},${y}`,
  );
  return image.luma[y * image.width + x];
}

const SURFACE_ROLES = ['canvas', 'band', 'tile', 'control'];

function surfaceRegionMean(image, [centerX, centerY]) {
  let sum = 0;
  let count = 0;
  for (let y = centerY - 2; y <= centerY + 2; y += 1) {
    for (let x = centerX - 2; x <= centerX + 2; x += 1) {
      assert.ok(
        x >= 0 && x < image.width && y >= 0 && y < image.height,
        `surface region out of bounds: ${centerX},${centerY}`,
      );
      sum += image.luma[y * image.width + x];
      count += 1;
    }
  }
  return sum / count;
}

export function assertSurfaceThemeParity(width, target, light, dark) {
  const points = roleSamplePoints(target, width);
  const lightSurfaces = Object.fromEntries(
    SURFACE_ROLES.map((role) => [role, surfaceRegionMean(light, points[role])]),
  );
  const darkSurfaces = Object.fromEntries(
    SURFACE_ROLES.map((role) => [role, surfaceRegionMean(dark, points[role])]),
  );

  for (const role of SURFACE_ROLES) {
    assert.ok(
      lightSurfaces[role] - darkSurfaces[role] > 35,
      `${width}px ${target} ${role} surface did not switch light to dark`,
    );
  }

  for (const role of ['band', 'tile', 'control']) {
    assert.ok(
      Math.abs(lightSurfaces[role] - lightSurfaces.canvas) > 3,
      `${width}px ${target} light ${role} collapsed into canvas`,
    );
    assert.ok(
      Math.abs(darkSurfaces[role] - darkSurfaces.canvas) > 3,
      `${width}px ${target} dark ${role} collapsed into canvas`,
    );
  }

  const lightInk = sampleLuma(light, points.ink);
  const darkInk = sampleLuma(dark, points.ink);
  for (const role of SURFACE_ROLES) {
    assert.ok(
      lightSurfaces[role] - lightInk > 50,
      `${width}px ${target} light ink lacks contrast on ${role}`,
    );
    assert.ok(
      darkInk - darkSurfaces[role] > 50,
      `${width}px ${target} dark ink lacks contrast on ${role}`,
    );
  }

  return { lightSurfaces, darkSurfaces, lightInk, darkInk };
}

function maxChannelDelta(a, b) {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

export function assertRoleParity(width, scheme, app, reference) {
  const appPoints = roleSamplePoints('app', width);
  const referencePoints = roleSamplePoints('reference', width);
  const sampled = {};
  for (const role of Object.keys(appPoints)) {
    const appColor = sampleRgb(app, appPoints[role]);
    const referenceColor = sampleRgb(reference, referencePoints[role]);
    const delta = maxChannelDelta(appColor, referenceColor);
    const tolerance = ROLE_TOLERANCE[role] ?? 2;
    assert.ok(
      delta <= tolerance,
      `${width}px ${scheme} ${role} role diverged: app rgb(${appColor}) vs reference rgb(${referenceColor})`,
    );
    sampled[role] = appColor.join(',');
  }
  return sampled;
}

function main(matrixDir) {
  assert.ok(matrixDir, 'usage: node issue-80-screenshot-parity.mjs <matrix-dir>');
  for (const width of [390, 414, 430]) {
    const images = {};
    for (const target of ['app', 'reference']) {
      const light = decodePng(join(matrixDir, `${target}-${width}-light.png`));
      const dark = decodePng(join(matrixDir, `${target}-${width}-dark.png`));
      assert.deepEqual(
        [light.width, light.height],
        [width, 1200],
        `${target} ${width}px light screenshot dimensions`,
      );
      assert.deepEqual(
        [dark.width, dark.height],
        [width, 1200],
        `${target} ${width}px dark screenshot dimensions`,
      );
      const lightStats = stats(light);
      const darkStats = stats(dark);
      images[target] = { light, dark, lightStats, darkStats };
      assert.ok(lightStats.deviation > 20, `${target} ${width}px light screenshot is blank`);
      assert.ok(darkStats.deviation > 20, `${target} ${width}px dark screenshot is blank`);
      const surfaceTheme = assertSurfaceThemeParity(width, target, light, dark);
      const structure = correlation(rowEdgeProfile(light), rowEdgeProfile(dark));
      assert.ok(
        structure > 0.72,
        `${target} ${width}px light/dark hierarchy diverged (${structure.toFixed(3)})`,
      );
      console.log(
        `OK: ${target} ${width}px light/dark surfaces (${SURFACE_ROLES.map((role) => `${role}=${surfaceTheme.lightSurfaces[role].toFixed(1)}/${surfaceTheme.darkSurfaces[role].toFixed(1)}`).join(' ')}, ink=${surfaceTheme.lightInk.toFixed(1)}/${surfaceTheme.darkInk.toFixed(1)}, hierarchy ${structure.toFixed(3)})`,
      );
    }
    for (const scheme of ['light', 'dark']) {
      const sampled = assertRoleParity(
        width,
        scheme,
        images.app[scheme],
        images.reference[scheme],
      );
      console.log(
        `OK: app/reference ${width}px ${scheme} role parity (${Object.entries(sampled).map(([role, color]) => `${role}=${color}`).join(' ')})`,
      );
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]);
}
