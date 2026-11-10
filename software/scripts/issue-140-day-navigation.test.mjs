import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import ts from 'typescript';

const source = readFileSync(new URL('../app/(tabs)/today.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('today.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const selector = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'DateSelector');
assert.ok(selector, 'exercise the production DateSelector');
const js = ts.transpileModule(selector.getText(ast), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const render = new Function(
  'React', 'useTheme', 'I18nManager', 'View', 'Pressable', 'Text', 'styles',
  'localDayKeyFromDate', 'formatDayLabel', 'shiftDayKey',
  `${js}; return DateSelector;`,
);

for (const [direction, manager, glyphs] of [
  ['LTR', { isRTL: false }, ['‹', '›']],
  ['RTL', { isRTL: true }, ['›', '‹']],
  ['web undefined', { isRTL: undefined }, ['‹', '›']],
  ['web missing flag', {}, ['‹', '›']],
]) {
  test(`issue 140: ${direction} renders directional glyphs and preserves navigation`, () => {
    const shifts = [];
    const changes = [];
    const DateSelector = render(
      React,
      () => ({ colors: {}, typography: {}, font: () => ({}), spacing: {}, radius: {} }),
      manager, 'View', 'Pressable', 'Text', {},
      () => '2026-10-31', () => 'Today',
      (dayKey, delta) => { shifts.push([dayKey, delta]); return `shifted:${delta}`; },
    );
    const tree = DateSelector({ dayKey: '2026-10-31', onChange: (day) => changes.push(day) });
    const buttons = tree.props.children.filter((child) => child.type === 'Pressable');
    assert.equal(buttons.length, 2);
    assert.deepEqual(buttons.map((button) => button.props.children.props.children), glyphs);
    assert.deepEqual(buttons.map((button) => button.props.accessibilityLabel), ['Previous day', 'Next day']);
    for (const button of buttons) {
      assert.equal(button.props.accessibilityRole, 'button');
      button.props.onPress();
    }
    assert.deepEqual(shifts, [['2026-10-31', -1], ['2026-10-31', 1]]);
    assert.deepEqual(changes, ['shifted:-1', 'shifted:1']);
  });
}
