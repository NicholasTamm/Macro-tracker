import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';

const source = readFileSync(new URL('../design-system/components/MacroSummary.tsx', import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const colorsModule = { exports: {} };
new Function('exports', compile(readFileSync(new URL('../design-system/tokens/colors.ts', import.meta.url), 'utf8')))(colorsModule.exports);
let colors = colorsModule.exports.lightPalette;
const exports = {};
new Function('require', 'exports', compile(source))((id) => {
  if (id === 'react') return React;
  if (id === 'react-native') return { View: 'view', Text: 'text', StyleSheet: { create: (x) => x, hairlineWidth: 1 } };
  if (id === '../theme') return { useTheme: () => ({ colors, spacing: { xs: 4, sm: 8 }, typography: {}, font: () => ({}) }) };
  if (id === './Card') return { Card: 'card' };
  if (id.endsWith('unitDisplay')) return { formatEnergy: (value, unit) => String(Math.round(value * (unit === 'kJ' ? 4.184 : 1))), energyUnitForSpeech: (unit) => unit === 'kJ' ? 'kilojoules' : 'kilocalories' };
  throw new Error(id);
}, exports);
const { macroProgress, MacroSummary } = exports;
const children = (el) => React.Children.toArray(el.props.children);
const style = (el) => Object.assign({}, ...el.props.style);

test('issue 139: empty, half, full, near-target and over-target progress', () => {
  for (const [value, goal, fill, percent, over] of [
    [0, 100, 0, 0, false], [50, 100, .5, 50, false], [100, 100, 1, 100, false],
    [2217, 2300, 2217 / 2300, 96, false], [366, 230, 1, 159, true],
    [100.01, 100, 1, 100, true],
  ]) assert.deepEqual(macroProgress(value, goal), { fill, percent, over });
});

test('issue 139: unknown totals and invalid goals never invent progress', () => {
  for (const [value, goal] of [[null, 100], [NaN, 100], [Infinity, 100], [-1, 100], [50, undefined], [50, 0], [50, -1], [50, NaN], [50, Infinity]]) {
    assert.deepEqual(macroProgress(value, goal), { fill: 0, percent: null, over: false });
  }
});

test('issue 139: each themed cell renders computed width, readable over text and accessible percentage', () => {
  for (const palette of [colorsModule.exports.lightPalette, colorsModule.exports.darkPalette]) {
    colors = palette;
    const tree = MacroSummary({ totals: { calories: 0, calorieGoal: 2000, protein: 50, proteinGoal: 100, fat: 80, fatGoal: 80, carbs: 366, carbsGoal: 230 } });
    assert.equal(tree.props.accessibilityLabel, undefined, 'parent must not swallow cell labels');
    const cells = children(children(tree)[0]);
    cells.forEach((cell, i) => {
      assert.equal(cell.props.accessible, true);
      assert.match(cell.props.accessibilityLabel, new RegExp(`${[0, 50, 100, 159][i]}% of target`));
      const parts = children(cell);
      const track = parts.at(-1);
      assert.equal(style(track).backgroundColor, colors.control);
      assert.equal(style(track).borderColor, colors.controlBorder);
      const fill = children(track)[0];
      assert.equal(style(fill).width, ['0%', '50%', '100%', '100%'][i]);
      assert.equal(style(fill).backgroundColor, colors[['energy', 'protein', 'fat', 'carbs'][i]]);
      assert.equal(style(fill).borderWidth, i === 0 ? 0 : 1);
      if (i === 3) {
        assert.equal(parts.at(-2).props.children, 'Over target');
        assert.equal(style(parts.at(-2)).color, colors.ink);
        assert.match(cell.props.accessibilityLabel, /over target/);
      } else assert.equal(parts.length, 3, 'no over marker at or below target');
    });
  }
});

test('issue 139: kJ rounding cannot hide an overage; unavailable progress is announced', () => {
  const totals = { calories: 100.01, calorieGoal: 100, protein: null, fat: 1, carbs: 0 };
  const cells = children(children(MacroSummary({ totals, energyUnit: 'kJ' }))[0]);
  assert.match(cells[0].props.accessibilityLabel, /kilojoules.*100% of target, over target/);
  assert.match(cells[1].props.accessibilityLabel, /unknown protein, progress unavailable/);
  assert.match(cells[2].props.accessibilityLabel, /progress unavailable/);
});

function contrast(a, b) {
  const luminance = (hex) => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test('issue 139: over text and track/fill boundaries have accessible contrast in both themes', () => {
  for (const palette of [colorsModule.exports.lightPalette, colorsModule.exports.darkPalette]) {
    assert.ok(contrast(palette.ink, palette.raised) >= 4.5, 'over label');
    assert.ok(contrast(palette.controlBorder, palette.raised) >= 3, 'empty track boundary');
    assert.ok(contrast(palette.ink, palette.control) >= 3, 'fill boundary against track');
  }
});
