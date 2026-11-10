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
const { MacroSummary } = exports;
const children = (el) => React.Children.toArray(el.props.children);


const text = (el) => typeof el === 'string' || typeof el === 'number'
  ? String(el) : children(el).map(text).join('');
const cellsFor = (totals, energyUnit = 'kcal') => children(children(MacroSummary({ totals, energyUnit }))[0]);

test('issue 149: compact formatted strings keep units in labels and round grams only visually', () => {
  const cells = cellsFor({ calories: 2217, calorieGoal: 2300, protein: 194.9, proteinGoal: 173.2, fat: 100.1, fatGoal: 110.8, carbs: 399.9, carbsGoal: 400.2 });
  for (const [i, label, value, full] of [
    [0, 'Calories (kcal)', '2217 /2300', /2217 kilocalories, target 2300 kilocalories/],
    [1, 'Protein (g)', '195 /173', /194\.9 grams protein, target 173\.2 grams/],
    [2, 'Fat (g)', '100 /111', /100\.1 grams fat, target 110\.8 grams/],
    [3, 'Carbs (g)', '400 /400', /399\.9 grams carbs, target 400\.2 grams/],
  ]) {
    const parts = children(cells[i]);
    assert.equal(text(parts[0]), label);
    assert.equal(text(parts[1]), value);
    assert.match(cells[i].props.accessibilityLabel, full);
    assert.equal(parts[1].props.numberOfLines, 1);
    assert.equal(parts[1].props.adjustsFontSizeToFit, true);
  }
});

test('issue 149: unknowns, zero, absent targets and kJ keep their display semantics', () => {
  const cells = cellsFor({ calories: 2217, calorieGoal: 2300, protein: null, proteinGoal: 173.2, fat: 0, carbs: 0, carbsGoal: 0 }, 'kJ');
  assert.equal(text(children(cells[0])[0]), 'Energy (kJ)');
  assert.equal(text(children(cells[0])[1]), '9276 /9623');
  assert.match(cells[0].props.accessibilityLabel, /9276 kilojoules, target 9623 kilojoules/);
  assert.equal(text(children(cells[1])[1]), '— /173');
  assert.match(cells[1].props.accessibilityLabel, /unknown protein, target 173\.2 grams/);
  assert.equal(text(children(cells[2])[1]), '0');
  assert.equal(text(children(cells[3])[1]), '0 /0');
});
