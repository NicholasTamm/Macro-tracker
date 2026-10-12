import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const [matrixDir] = process.argv.slice(2);
assert.ok(matrixDir, 'usage: node issue-80-screenshot-parity.mjs <matrix-dir>');

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
  for (let i = 0; i < width * height; i += 1) {
    const p = i * channels;
    luma[i] = 0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2];
  }
  return { width, height, luma };
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

for (const width of [390, 414, 430]) {
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
    assert.ok(lightStats.deviation > 20, `${target} ${width}px light screenshot is blank`);
    assert.ok(darkStats.deviation > 20, `${target} ${width}px dark screenshot is blank`);
    assert.ok(
      lightStats.mean - darkStats.mean > 35,
      `${target} ${width}px theme pair does not visibly switch light to dark`,
    );
    const structure = correlation(rowEdgeProfile(light), rowEdgeProfile(dark));
    assert.ok(
      structure > 0.72,
      `${target} ${width}px light/dark hierarchy diverged (${structure.toFixed(3)})`,
    );
    console.log(
      `OK: ${target} ${width}px light/dark pair (luma ${lightStats.mean.toFixed(1)}/${darkStats.mean.toFixed(1)}, hierarchy ${structure.toFixed(3)})`,
    );
  }
}
