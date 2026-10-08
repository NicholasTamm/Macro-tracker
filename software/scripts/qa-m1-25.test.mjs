/** M1-25 settings navigation and choice accessibility regression gates. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pressable, Text, View } from 'react-native-web';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path) => readFileSync(join(softwareRoot, path), 'utf8');

test('header back control has a 44pt target, accessible name, and focus indicator', () => {
  const button = source('components/HeaderBackButton.tsx');
  assert.match(button, /accessibilityLabel=\{label\}/);
  assert.match(button, /accessibilityRole="button"/);
  assert.match(button, /width:\s*44/);
  assert.match(button, /height:\s*44/);
  assert.match(button, /outlineStyle:\s*focused \? 'solid'/);
  assert.match(button, /I18nManager\.isRTL/);
});

test('stack headers replace default route-group back text with destination labels', () => {
  const settings = source('app/settings/_layout.tsx');
  const onboarding = source('app/onboarding/_layout.tsx');

  assert.match(settings, /headerBackVisible:\s*false/);
  assert.match(settings, /label="Back to Settings"/);
  assert.doesNotMatch(settings, /\(tabs\)/);

  assert.match(onboarding, /headerBackVisible:\s*false/);
  for (const destination of [
    'Welcome',
    'Age confirmation',
    'Units',
    'About you',
    'Goal',
    'Safety exclusions',
  ]) {
    assert.match(onboarding, new RegExp(`label="Back to ${destination}"`));
  }
});

test('choice primitive exposes group, radio/checkbox checked state, size, and focus', () => {
  const choice = source('app/onboarding/ChoiceRow.tsx');
  assert.match(choice, /accessibilityRole="radiogroup"/);
  assert.match(choice, /accessibilityLabel=\{label\}/);
  assert.match(choice, /accessibilityRole=\{mode\}/);
  assert.match(choice, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(choice, /aria-checked=\{selected\}/);
  assert.match(choice, /minHeight:\s*44/);
  assert.match(choice, /outlineStyle:\s*focused \? 'solid'/);

  const exclusions = source('app/onboarding/exclusions.tsx');
  assert.match(exclusions, /mode="checkbox"/);
});

test('onboarding and settings mutually exclusive choices have radio groups', () => {
  const expectations = new Map([
    ['app/onboarding/units.tsx', ['Mass unit', 'Height unit', 'Energy unit']],
    ['app/onboarding/biometrics.tsx', ['Sex']],
    ['app/onboarding/goal.tsx', ['Goal direction']],
    ['app/settings/profile.tsx', ['Sex']],
    ['app/settings/units.tsx', ['Mass unit', 'Height unit', 'Energy unit', 'Theme']],
  ]);

  for (const [path, labels] of expectations) {
    const screen = source(path);
    for (const label of labels) {
      assert.match(screen, new RegExp(`<ChoiceGroup label="${label}">`), `${path}: ${label}`);
    }
  }
});

test('React Native Web emits radio group, checked state, and keyboard tab stop', () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      View,
      { accessibilityRole: 'radiogroup', accessibilityLabel: 'Mass unit' },
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'radio',
          accessibilityState: { checked: true },
          'aria-checked': true,
          accessibilityLabel: 'Kilograms (kg)',
          onPress() {},
        },
        React.createElement(Text, null, 'Kilograms (kg)'),
      ),
    ),
  );

  assert.match(markup, /aria-label="Mass unit" role="radiogroup"/);
  assert.match(markup, /aria-checked="true" aria-label="Kilograms \(kg\)" role="radio" tabindex="0"/);
});
