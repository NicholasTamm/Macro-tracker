import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';

// Render the production sheet with lightweight native primitives, using real
// quantity parsing/scaling. Hook state starts at the component's initial value.
function load(url) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', source)((id) => {
    if (id === 'react') return {
      ...React, useEffect: () => {}, useMemo: fn => fn(), useState: value => [value, () => {}],
    };
    if (id === 'react-native') return {
      Modal: 'modal', View: 'view', Text: 'text', TextInput: 'input', Pressable: 'button',
      Platform: { OS: 'web' }, StyleSheet: { create: x => x, hairlineWidth: 1 },
    };
    if (id === 'react-native-safe-area-context') return { SafeAreaView: 'view' };
    if (id === '@/design-system') return {
      MacroSummary: 'macros', PrimaryButton: 'save', ErrorBanner: 'error',
      useTheme: () => ({ colors: {}, spacing: {}, typography: {}, radius: {} }),
      useReduceMotion: () => true, modalAnimationFor: () => 'none',
    };
    if (id.startsWith('.')) return load(new URL(`${id}.ts`, url));
    throw new Error(id);
  }, exports);
  return exports;
}
const { DiaryEntryEditSheet } = load(new URL('../modules/diary/entry-edit/DiaryEntryEditSheet.tsx', import.meta.url));
function nodes(tree) {
  if (!React.isValidElement(tree)) return [];
  return [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)];
}
function text(tree) {
  if (!React.isValidElement(tree)) return String(tree ?? '');
  return React.Children.toArray(tree.props.children).map(text).join('');
}
function render(overrides = {}) {
  return DiaryEntryEditSheet({ visible: true, energyUnit: 'kcal', onClose() {}, onSave() {}, entry: {
    foodDisplayName: 'Egg', unitLabel: 'g', quantity: 150, grams: 150,
    nutritionSnapshot: { energy_kcal: 200, protein: 15, fat_total: 10, carbohydrate: 2 },
    ...overrides,
  } });
}

test('issue 147: subtitle clearly identifies gram and serving units without developer copy', () => {
  for (const unitLabel of ['g', 'egg', 'serving (30 g)']) {
    const tree = render({ unitLabel });
    const texts = nodes(tree).filter(node => node.type === 'text').map(text);
    assert.equal(texts[texts.indexOf('Egg') + 1], `Unit: ${unitLabel}`);
    assert.doesNotMatch(text(tree), /\b(?:snapshot|seed|rewrite)\b/i);
    assert.equal(nodes(tree).find(node => node.type === 'save').props.disabled, false);
  }
});

test('issue 147: failed nutrient calculation uses user-facing error copy and prevents saving', () => {
  const tree = render({ quantity: 0 });
  const error = nodes(tree).find(node => node.type === 'error');
  assert.equal(error.props.title, 'Cannot recalculate');
  assert.equal(error.props.message, 'Unable to calculate nutrients for this entry.');
  assert.doesNotMatch(text(tree) + error.props.message, /\b(?:snapshot|seed|rewrite)\b/i);
  assert.equal(nodes(tree).find(node => node.type === 'save').props.disabled, true);
});
