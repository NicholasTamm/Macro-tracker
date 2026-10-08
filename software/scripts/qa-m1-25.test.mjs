/** M1-25 settings navigation and choice accessibility regression gates. */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pressable, Text, View } from 'react-native-web';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path) => readFileSync(join(softwareRoot, path), 'utf8');
let bundleDir;
let HeaderBackButton;

before(async () => {
  bundleDir = mkdtempSync(join(softwareRoot, '.header-back-button-'));
  const outfile = join(bundleDir, 'HeaderBackButton.mjs');
  await build({
    entryPoints: [join(softwareRoot, 'components/HeaderBackButton.tsx')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'],
    plugins: [{
      name: 'header-back-test-stubs',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^(expo-router|react-native|@expo\/vector-icons)$/ }, ({ path }) => ({
          path,
          namespace: 'header-back-test-stub',
        }));
        buildApi.onLoad({ filter: /.*/, namespace: 'header-back-test-stub' }, ({ path }) => {
          if (path === 'expo-router') {
            return {
              contents: `export const router = {
                back() { throw new Error('HeaderBackButton must not use router.back()'); },
                replace(destination) { globalThis.__headerBackDestination = destination; },
              };`,
              loader: 'js',
            };
          }
          if (path === 'react-native') {
            return {
              contents: `import React from 'react';
                export const I18nManager = { isRTL: false };
                export function Pressable(props) {
                  globalThis.__headerBackOnPress = props.onPress;
                  return React.createElement('button');
                }`,
              loader: 'js',
            };
          }
          return { contents: 'export function Feather() { return null; }', loader: 'js' };
        });
      },
    }],
  });
  ({ HeaderBackButton } = await import(pathToFileURL(outfile).href));
});

after(() => {
  delete globalThis.__headerBackDestination;
  delete globalThis.__headerBackOnPress;
  rmSync(bundleDir, { recursive: true, force: true });
});

test('header back control has a 44pt target, accessible name, and focus indicator', () => {
  const button = source('components/HeaderBackButton.tsx');
  assert.match(button, /accessibilityLabel=\{label\}/);
  assert.match(button, /accessibilityRole="button"/);
  assert.match(button, /width:\s*44/);
  assert.match(button, /height:\s*44/);
  assert.match(button, /outlineStyle:\s*focused \? 'solid'/);
  assert.match(button, /I18nManager\.isRTL/);
});

test('header back control replaces the current route with its explicit destination', () => {
  renderToStaticMarkup(React.createElement(HeaderBackButton, {
    destination: '/settings',
    label: 'Back to Settings',
    tintColor: '#000000',
  }));

  assert.equal(typeof globalThis.__headerBackOnPress, 'function');
  globalThis.__headerBackOnPress();
  assert.equal(globalThis.__headerBackDestination, '/settings');
});

test('stack headers map destination labels to explicit routes', () => {
  const settings = source('app/settings/_layout.tsx');
  const onboarding = source('app/onboarding/_layout.tsx');

  assert.match(settings, /headerBackVisible:\s*false/);
  assert.match(settings, /destination="\/settings"\s+label="Back to Settings"/);
  assert.doesNotMatch(settings, /\(tabs\)/);

  assert.match(onboarding, /headerBackVisible:\s*false/);
  assert.match(onboarding, /name="adult" options=\{\{ title: 'Age confirmation', headerLeft: \(\) => null \}\}/);
  assert.doesNotMatch(onboarding, /Back to Welcome/);
  for (const [route, label] of [
    ['/onboarding/adult', 'Age confirmation'],
    ['/onboarding/units', 'Units'],
    ['/onboarding/biometrics', 'About you'],
    ['/onboarding/goal', 'Goal'],
    ['/onboarding/exclusions', 'Safety exclusions'],
  ]) {
    assert.match(
      onboarding,
      new RegExp(`destination="${route}"\\s+label="Back to ${label}"`),
    );
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
