import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';

function load(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)((id) => {
    if (id in imports) return imports[id];
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsx;
    throw new Error(`Unexpected import ${id}`);
  }, exports);
  return exports;
}
const units = load('../modules/app-core/user-data/unitConvert.ts');
const settings = load('../modules/app-core/settings/unitDisplay.ts', { '../user-data/unitConvert': units });
const palettes = load('../design-system/tokens/colors.ts');
const native = { View: 'view', Text: 'text', TextInput: 'input', ScrollView: 'scroll', Pressable: 'button', StyleSheet: { create: x => x } };
const descendants = el => !React.isValidElement(el) ? [] : [el, ...React.Children.toArray(el.props.children).flatMap(descendants)];

function harness(profile, colors = palettes.lightPalette) {
  const state = [];
  let cursor = 0;
  const calls = [];
  const db = {};
  const design = { useTheme: () => ({ colors, spacing: {}, radius: {}, typography: {} }), Card: 'card', Mascot: 'mascot' };
  design.PrimaryButton = load('../design-system/components/PrimaryButton.tsx', { 'react-native': native, '../theme': design }).PrimaryButton;
  const shell = load('../app/onboarding/OnboardingShell.tsx', {
    'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'safe' }, '@/design-system': design,
  }).OnboardingShell;
  const Screen = load('../app/onboarding/biometrics.tsx', {
    react: { ...React, useMemo: fn => fn(), useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    } },
    'react-native': native, 'expo-router': { router: { push: route => calls.push(['push', route]), back() {} } },
    './OnboardingShell': { OnboardingShell: shell }, './ChoiceRow': { ChoiceGroup: 'group', ChoiceRow: 'choice' },
    '@/design-system': design, '@/modules/app-core/settings': settings,
    '@/components/UserDataProvider': { useUserData: () => ({ db, snapshot: { profile }, refresh: () => calls.push(['refresh']) }) },
    '@/modules/app-core/user-data': { ...units, saveBiometrics: (database, bio) => { assert.equal(database, db); calls.push(['save', bio]); } },
  }).default;
  const render = () => { cursor = 0; return Screen(); };
  const fields = () => descendants(render()).filter(el => el.type === 'input');
  return {
    calls, render,
    values: () => fields().map(el => el.props.value),
    set: (index, value) => fields()[index].props.onChangeText(value),
    button: () => {
      const primary = descendants(shell(render().props)).find(el => el.type === design.PrimaryButton);
      return design.PrimaryButton(primary.props);
    },
  };
}

for (const scheme of ['light', 'dark']) test(`fresh biometrics require every field; brand disabled tokens in ${scheme}`, () => {
  const colors = palettes[`${scheme}Palette`];
  const h = harness({ birthYear: null, heightCm: null, weightKg: null }, colors);
  assert.deepEqual(h.values(), ['', '', '']);
  assert.equal(h.render().props.primaryDisabled, true);
  h.render().props.onPrimary();
  assert.deepEqual(h.calls, []);
  const button = h.button();
  assert.equal(button.props.disabled, true);
  assert.deepEqual(button.props.accessibilityState, { disabled: true });
  assert.equal(button.props.style({ pressed: false })[1].backgroundColor, colors.control);
  assert.equal(button.props.style({ pressed: false })[1].opacity, 1);
  assert.equal(button.props.children.props.style[1].color, colors.muted);
  assert.equal(h.render().props.secondaryLabel, 'Back');
  ['1990', '170', '70'].forEach((v, i) => {
    h.set(i, v);
    assert.equal(h.render().props.primaryDisabled, i < 2);
  });
  assert.equal(h.button().props.disabled, false);
  assert.equal(h.button().props.style({ pressed: false })[1].backgroundColor, colors.brand);
  h.button().props.onPress();
  assert.deepEqual(h.calls, [
    ['save', { sex: 'unspecified', birthYear: 1990, heightCm: 170, weightKg: 70 }],
    ['refresh'], ['push', '/onboarding/goal'],
  ]);
});

test('invalid or cleared required fields block submission even when other fields are valid', () => {
  const h = harness({ birthYear: 1990, heightCm: 170, weightKg: 70 });
  const valid = ['1990', '170', '70'];
  for (const index of [0, 1, 2]) {
    const invalid = ['', ' ', 'abc', '0', '-1', 'Infinity', 'NaN', ...(index === 0 ? ['1899', '1990.5', String(new Date().getFullYear() - 17), String(new Date().getFullYear() + 1)] : [])];
    for (const value of invalid) {
      h.set(index, value);
      assert.equal(h.render().props.primaryDisabled, true, `field ${index}: ${value}`);
      h.render().props.onPrimary();
      assert.deepEqual(h.calls, []);
    }
    h.set(index, valid[index]);
    assert.equal(h.render().props.primaryDisabled, false);
  }
});

test('saved biometrics remain populated and imperial input saves canonical cm/kg', () => {
  const h = harness({ birthYear: 1990, heightCm: 170, weightKg: 70, heightUnit: 'in', massUnit: 'lb' });
  assert.deepEqual(h.values(), ['1990', '66.9', '154.3']);
  h.set(1, '67');
  h.set(2, '154');
  h.render().props.onPrimary();
  assert.deepEqual(h.calls[0], ['save', { sex: 'unspecified', birthYear: 1990, heightCm: 170.2, weightKg: 69.9 }]);
  assert.deepEqual(h.calls.at(-1), ['push', '/onboarding/goal']);
  const empty = harness({ heightUnit: 'in', massUnit: 'lb' });
  assert.deepEqual(empty.values(), ['', '', '']);
  assert.equal(empty.render().props.primaryDisabled, true);
});
