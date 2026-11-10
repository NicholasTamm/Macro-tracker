import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import React from 'react';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const entry = read('app/(tabs)/food-entry.tsx');
const exports = {};
const source = ts.transpileModule(read('design-system/components/EmptyState.tsx'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
new Function('require', 'exports', source)(id => {
  if (id === 'react') return React;
  if (id === 'react-native') return { View: 'view', Text: 'text', StyleSheet: { create: x => x } };
  if (id === '../theme') return { useTheme: () => ({ colors: {}, spacing: {}, typography: {} }) };
  if (id === './PrimaryButton') return { PrimaryButton: 'button' };
  if (id === './Mascot') return { Mascot: 'mascot' };
  throw new Error(id);
}, exports);
const { EmptyState } = exports;
function nodes(tree) {
  if (!React.isValidElement(tree)) return [];
  return [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)];
}
function stateProps(marker) {
  const start = entry.indexOf(marker);
  assert.ok(start >= 0);
  const block = entry.slice(start).match(/<EmptyState\s+([\s\S]*?)\/>/)[1];
  return Object.fromEntries([...block.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
}

test('issue 148: no results renders the same 96px think mascot as empty search, outside the food list', () => {
  const props = stateProps('showEmptyResults ? (');
  assert.equal(props.title, 'No matching foods');
  assert.equal(props.message, 'Try another search. Packaged online search is not available offline.');
  assert.equal(props.mascotPose, 'think');
  for (const input of [props, stateProps('showEmptyBrowse ? (')]) {
    const tree = EmptyState(input);
    const mascot = nodes(tree).find(node => node.type === 'mascot');
    assert.equal(mascot.props.pose, 'think');
    assert.equal(mascot.props.size, 96);
    const graphic = nodes(tree).find(node => node.props.children?.type === 'mascot');
    assert.equal(graphic.props.accessibilityElementsHidden, true);
    assert.equal(graphic.props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(tree.props.accessibilityLabel, `${input.title}. ${input.message}`);
  }
  assert.match(entry, /showEmptyResults \? \(\s*<EmptyState[^]*?\/>\s*\) : \(\s*<SectionList/);
});

test('issue 148: absent art leaves no graphic or fallback; custom art takes precedence and CTA still works', () => {
  for (const illustration of [undefined, null]) {
    const tree = EmptyState({ title: 'Empty', illustration });
    assert.equal(nodes(tree).filter(node => node.type === 'view').length, 1);
    assert.equal(nodes(tree).filter(node => node.type === 'mascot').length, 0);
  }
  let called = false;
  const illustration = React.createElement('custom-art');
  const tree = EmptyState({ title: 'Empty', mascotPose: 'think', illustration,
    actionLabel: 'Search', actionVariant: 'brand', onAction: () => { called = true; } });
  assert.equal(nodes(tree).filter(node => node.type === 'custom-art').length, 1);
  assert.equal(nodes(tree).filter(node => node.type === 'mascot').length, 0);
  const button = nodes(tree).find(node => node.type === 'button');
  assert.equal(button.props.label, 'Search');
  assert.equal(button.props.variant, 'brand');
  button.props.onPress();
  assert.equal(called, true);
});

test('issue 148: production routes and shared EmptyState have no clipboard emoji', () => {
  function check(directory) {
    for (const item of readdirSync(new URL(directory, root), { withFileTypes: true })) {
      const path = `${directory}/${item.name}`;
      if (item.isDirectory()) check(path);
      else if (/\.[jt]sx?$/.test(item.name)) assert.doesNotMatch(read(path), /📋/, path);
    }
  }
  check('app');
  assert.doesNotMatch(read('design-system/components/EmptyState.tsx'), /📋/);
});
