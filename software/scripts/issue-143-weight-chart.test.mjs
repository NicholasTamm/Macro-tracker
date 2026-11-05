import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

let weight;
let WeightChart;
before(async () => {
  const result = await build({
    stdin: {
      contents: `export * from './modules/app-core/weight/weightSeries';
        export * from './modules/app-core/weight/WeightChart';`,
      resolveDir: process.cwd(),
    },
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{
      name: 'chart-host',
      setup(b) {
        b.onResolve({ filter: /^react-native$|^@\/design-system$/ }, ({ path }) => ({ path, namespace: 'host' }));
        b.onLoad({ filter: /.*/, namespace: 'host' }, ({ path }) => ({ contents: path === 'react-native'
          ? `export const View = 'View', Text = 'Text'; export const StyleSheet = {create: x => x, hairlineWidth: 1};`
          : `export const useTheme = () => ({colors: {}, spacing: {}, typography: {}, radius: {}});` }));
      },
    }],
  });
  weight = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  WeightChart = weight.WeightChart;
});

const now = new Date(2026, 9, 30, 15);
const sample = (id, date, kilograms, deletedAt = null) => ({
  id, timestamp: `${date}T12:00:00.000Z`, kilograms, deletedAt,
});

// Exercise rendered View styles, including the percentage's containing block.
test('issue 143: endpoint dots fit inside the plot at mobile and wide widths', () => {
  const points = weight.chartPoints([
    sample('first', '2026-09-30', 82), sample('last', '2026-10-30', 80),
  ], now);
  assert.deepEqual(points.map(p => p.x), [0, 1]);
  const plot = WeightChart({ points, summaryText: 'Two weights' }).props.children[0];
  const track = plot.props.children;
  const inset = track.props.style;
  const dots = track.props.children;
  assert.equal(inset.position, 'absolute');
  for (const width of [240, 362, 768]) {
    const border = plot.props.style[0].borderWidth;
    const trackWidth = width - 2 * border - inset.start - inset.end;
    for (const dot of dots) {
      const style = Object.assign({}, ...dot.props.style);
      const left = border + inset.start + parseFloat(style.start) / 100 * trackWidth + style.marginStart;
      assert.ok(left >= border, `left edge ${left} clipped at width ${width}`);
      assert.ok(left + style.width <= width - border, `right edge clipped at width ${width}`);
    }
  }
});

test('issue 143: same civil day uses the mean; all summary values and entries survive', () => {
  const samples = [
    sample('a', '2026-10-08', 82), sample('b', '2026-10-15', 81.6),
    sample('c', '2026-10-22', 81.2), sample('d', '2026-10-30', 80.9),
    sample('e', '2026-10-30', 80.4), sample('deleted', '2026-10-30', 100, 'deleted'),
  ];
  const original = structuredClone(samples);
  const windowed = weight.windowSamples(samples, now);
  const summary = weight.summarizeWeights(windowed);
  const points = weight.chartPoints(windowed, now);
  assert.equal(points.length, 4);
  assert.equal(new Set(points.map(p => p.x)).size, 4);
  assert.ok(Math.abs(points.at(-1).kilograms - 80.65) < 1e-10);
  assert.equal(points.at(-1).x, 1);
  assert.equal(summary.count, 5);
  assert.equal(summary.latestKg, 80.4);
  assert.equal(summary.minKg, 80.4);
  assert.equal(summary.maxKg, 82);
  assert.ok(Math.abs(summary.changeKg + 1.6) < 1e-10);
  assert.deepEqual(weight.summarizeWeights(windowed), summary);
  assert.deepEqual(samples, original, 'aggregation must not mutate the entry list');
});

test('issue 143: a single day of equal weigh-ins yields one centered finite point', () => {
  assert.deepEqual(weight.chartPoints([], now), []);
  const points = weight.chartPoints([
    sample('a', '2026-10-30', 80), sample('b', '2026-10-30', 80),
  ], now);
  assert.equal(points.length, 1);
  assert.deepEqual(points[0], { id: 'a', x: 0.5, y: 0.5, kilograms: 80 });
});

test('issue 143: legacy instants aggregate by the local civil date used by x scaling', () => {
  const previousTZ = process.env.TZ;
  process.env.TZ = 'America/Vancouver';
  try {
    const points = weight.chartPoints([
      sample('civil', '2026-10-29', 82),
      { ...sample('legacy', '2026-10-30', 80), timestamp: '2026-10-30T06:30:00.000Z' },
      sample('today', '2026-10-30', 79),
    ], now);
    assert.equal(points.length, 2);
    assert.equal(points[0].kilograms, 81);
    assert.ok(points[0].x < points[1].x);
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});
