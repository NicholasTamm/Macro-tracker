import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
function tokens(path) {
  const exports = {};
  new Function('exports', compile(path))(exports);
  return exports;
}
const { Typography, SystemTypography } = tokens('../design-system/tokens/typography.ts');
const { Spacing } = tokens('../design-system/tokens/spacing.ts');
const source = compile('../app/(tabs)/_layout.tsx');
function options(platform, bottom, typography) {
  const exports = {};
  new Function('require', 'exports', '__DEV__', source)((id) => {
    if (id === 'react') return React;
    if (id === 'react-native') return { Platform: { OS: platform } };
    if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom }) };
    if (id === 'expo-router') return { Tabs: Object.assign(() => null, { Screen: () => null }) };
    if (id === '@expo/vector-icons') return { Feather: () => null, MaterialIcons: () => null };
    if (id === '@/design-system') return { useTheme: () => ({ colors: {}, typography, spacing: Spacing }) };
    throw new Error(id);
  }, exports, false);
  return exports.default().props.screenOptions;
}
for (const platform of ['web', 'ios', 'android']) {
  for (const bottom of [0, 21, 34]) {
    test(`${platform}, bottom inset ${bottom}: full caption and icon fit above safe area; targets >=44px`, () => {
      for (const typography of [SystemTypography, Typography]) {
        const config = options(platform, bottom, typography);
        const { height, paddingBottom } = config.tabBarStyle;
        assert.equal(paddingBottom, bottom, 'keep home indicator area outside tab buttons');
        const contentHeight = height - paddingBottom - 1; // top border
        assert.ok(contentHeight >= 44, 'minimum tab hit height');
        assert.ok(contentHeight >= config.tabBarIconStyle.height + config.tabBarLabelStyle.lineHeight + Spacing.sm * 2,
          'icon, full caption line-height and vertical padding must all fit');
        assert.deepEqual(config.tabBarLabelStyle, typography.caption, 'preserve design-system caption');
      }
    });
  }
}
test('height follows caption line-height changes instead of a fixed navigation default', () => {
  const normal = options('web', 0, Typography).tabBarStyle.height;
  const larger = options('web', 0, { ...Typography, caption: { ...Typography.caption, lineHeight: 20 } }).tabBarStyle.height;
  assert.equal(larger - normal, 20 - Typography.caption.lineHeight);
});
