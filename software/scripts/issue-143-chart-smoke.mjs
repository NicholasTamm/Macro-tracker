// Render the production chart through React Native Web; inspect browser geometry.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../design-system/theme/ThemeProvider';
import { WeightChart } from '../modules/app-core/weight/WeightChart';
import { chartPoints, summarizeWeights, weightSummaryText } from '../modules/app-core/weight/weightSeries';

const scheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
const now = new Date(2026, 9, 30, 15);
// Include both range endpoints, the reported reproduction and a flat single-day case.
const samples = [
  ['2026-09-30', 83], ['2026-10-08', 82], ['2026-10-15', 81.6],
  ['2026-10-22', 81.2], ['2026-10-30', 80.9], ['2026-10-30', 80.4],
].map(([date, kilograms], id) => ({ id: String(id), timestamp: `${date}T12:00:00.000Z`, kilograms, deletedAt: null }));
const cases = [samples, samples.slice(1), [samples.at(-1), samples.at(-1)]];
const root = document.getElementById('root');
createRoot(root).render(React.createElement(ThemeProvider, { forcedScheme: scheme },
  ...cases.map((entries, index) => React.createElement('div', { key: index, style: { margin: 14 } },
    React.createElement(WeightChart, {
      points: chartPoints(entries, now),
      summaryText: weightSummaryText(summarizeWeights(entries), 'kg'),
      minLabel: '80.4 kg', maxLabel: '83.0 kg',
    }))),
));

function verify() {
  try {
    const charts = [...document.querySelectorAll('[role="img"]')];
    if (charts.length !== cases.length) throw new Error('charts did not mount');
    let todayCenter;
    charts.forEach((chart, index) => {
      const plot = chart.firstElementChild;
      const dots = [...plot.firstElementChild.children];
      const box = plot.getBoundingClientRect();
      const expected = chartPoints(cases[index], now);
      if (dots.length !== [5, 4, 1][index]) throw new Error('same-day dots were not aggregated');
      const centers = [];
      dots.forEach((dot) => {
        const rect = dot.getBoundingClientRect();
        if (rect.width !== 10 || rect.height !== 10) throw new Error('dot size changed');
        if (rect.left < box.left + 1 || rect.right > box.right - 1 ||
            rect.top < box.top + 1 || rect.bottom > box.bottom - 1) {
          throw new Error('dot clipped by plot');
        }
        centers.push(rect.left + rect.width / 2);
      });
      if (new Set(centers).size !== expected.length) throw new Error('dots overlap');
      if (index === 0) todayCenter = centers.at(-1);
      if (index === 2 && Math.abs(centers[0] - todayCenter) > 1) {
        throw new Error('single-day today point is not at the right edge');
      }
    });
    document.body.append(Object.assign(document.createElement('pre'), {
      textContent: `ISSUE_143_BROWSER_PASS ${scheme}: endpoints and same-day means visible`,
    }));
  } catch (error) {
    document.body.append(Object.assign(document.createElement('pre'), { textContent: `FAIL: ${error.message}` }));
  }
}
setTimeout(verify, 1500);
