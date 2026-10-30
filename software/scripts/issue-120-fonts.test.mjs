import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { build } from 'esbuild';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');

async function loadTypography() {
  const dir = mkdtempSync(join(tmpdir(), 'macro-tracker-typo-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    const out = ts.transpileModule(read('design-system/tokens/typography.ts'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    writeFileSync(join(dir, 'typography.js'), out);
    return await import(pathToFileURL(join(dir, 'typography.js')).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function renderLayoutOptions(relativePath) {
  const dir = mkdtempSync(join(softwareRoot, '.issue-120-layout-'));
  const outfile = join(dir, 'layout.mjs');
  try {
    await build({
      entryPoints: [join(softwareRoot, relativePath)],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      define: { __DEV__: 'false' },
      external: ['react', 'react/jsx-runtime'],
      plugins: [{
        name: 'issue-120-layout-stubs',
        setup(buildApi) {
          buildApi.onResolve(
            { filter: /^(expo-router|@expo\/vector-icons|@\/design-system|@\/components\/HeaderBackButton)$/ },
            ({ path }) => ({ path, namespace: 'layout-stub' }),
          );
          buildApi.onLoad({ filter: /.*/, namespace: 'layout-stub' }, ({ path }) => {
            if (path === 'expo-router') {
              return {
                contents: `import React from 'react';
                  export function Tabs(props) { return React.createElement('tabs', props); }
                  Tabs.Screen = function Screen(props) { return React.createElement('screen', props); };
                  export function Stack(props) { return React.createElement('stack', props); }
                  Stack.Screen = function Screen(props) { return React.createElement('screen', props); };`,
                loader: 'js',
              };
            }
            if (path === '@/design-system') {
              return {
                contents: `export function useTheme() {
                  return {
                    colors: { ink: '#000', muted: '#666', raised: '#fff', divider: '#ddd', canvas: '#fff' },
                    typography: {
                      caption: { fontFamily: 'Figtree_500Medium', fontSize: 11, lineHeight: 14 },
                      pageTitle: { fontFamily: 'Nunito_700Bold', fontSize: 28, lineHeight: 32 },
                    },
                  };
                }`,
                loader: 'js',
              };
            }
            if (path === '@/components/HeaderBackButton') {
              return { contents: 'export function HeaderBackButton() { return null; }', loader: 'js' };
            }
            return {
              contents: 'export function Feather() { return null; } export function MaterialIcons() { return null; }',
              loader: 'js',
            };
          });
        },
      }],
    });
    const { default: Layout } = await import(pathToFileURL(outfile).href);
    return Layout().props.screenOptions;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('issue 120: UI roles use Figtree and display roles use Nunito once loaded', async () => {
  const t = await loadTypography();
  for (const [role, style] of Object.entries(t.Typography)) {
    const display = t.DISPLAY_ROLES.includes(role);
    assert.match(style.fontFamily, display ? /^Nunito_(700Bold|800ExtraBold)$/ : /^Figtree_(400Regular|500Medium|600SemiBold|700Bold)$/, role);
    assert.equal(style.fontWeight, undefined, `${role} drops fontWeight on the named face`);
  }
  assert.equal(t.Typography.display.fontFamily, 'Nunito_800ExtraBold');
  assert.equal(t.Typography.pageTitle.fontFamily, 'Nunito_700Bold');
  assert.equal(t.Typography.body.fontFamily, 'Figtree_400Regular');
  assert.equal(t.Typography.metric.fontFamily, 'Figtree_600SemiBold');
  for (const role of ['pageTitle', 'control', 'foodName', 'metadata', 'chartAxis']) {
    assert.ok(t.Typography[role], `#118 role ${role} kept`);
  }
});

test('issue 120: system fallback keeps identical metrics so the swap does not reflow', async () => {
  const t = await loadTypography();
  assert.equal(t.typographyFor(false), t.SystemTypography);
  assert.equal(t.typographyFor(true), t.Typography);
  for (const role of Object.keys(t.SystemTypography)) {
    const sys = t.SystemTypography[role];
    const br = t.Typography[role];
    assert.equal(sys.fontFamily, undefined, `${role} system scale has no custom family`);
    assert.equal(br.fontSize, sys.fontSize, role);
    assert.equal(br.lineHeight, sys.lineHeight, role);
    assert.ok(typeof sys.lineHeight === 'number', `${role} has a fixed lineHeight`);
  }
});

test('issue 120: numeric roles use tabular figures', async () => {
  const t = await loadTypography();
  for (const role of ['metric', 'metricCompact', 'chartAxis']) {
    assert.deepEqual(t.Typography[role].fontVariant, ['tabular-nums'], role);
    assert.deepEqual(t.SystemTypography[role].fontVariant, ['tabular-nums'], role);
  }
  assert.match(read('design-system/components/MacroSummary.tsx'), /fontVariant: \['tabular-nums'\]/);
  assert.match(read('modules/app-core/weight/WeightChart.tsx'), /typography\.chartAxis/);
});

test('issue 120: weightStyle swaps fontWeight for the matching Figtree face', async () => {
  const t = await loadTypography();
  assert.deepEqual(t.weightStyle('700', false), { fontWeight: '700' });
  assert.deepEqual(t.weightStyle('700', true), { fontFamily: 'Figtree_700Bold' });
  assert.deepEqual(t.weightStyle('800', true), { fontFamily: 'Figtree_700Bold' });
  assert.deepEqual(t.weightStyle('500', true), { fontFamily: 'Figtree_500Medium' });
});

test('issue 120: fonts load without blocking render and fall back on failure', () => {
  const hook = read('design-system/fonts/useProductFonts.ts');
  assert.match(hook, /useFonts\(PRODUCT_FONT_MAP\)/);
  assert.match(hook, /return loaded && !error/);
  for (const face of ['figtree/400Regular', 'figtree/500Medium', 'figtree/600SemiBold', 'figtree/700Bold', 'nunito/700Bold', 'nunito/800ExtraBold']) {
    assert.match(hook, new RegExp(`@expo-google-fonts/${face}'`), face);
  }
  const provider = read('design-system/theme/ThemeProvider.tsx');
  assert.match(provider, /typographyFor\(fontsLoaded\)/);
  const layout = read('app/_layout.tsx');
  assert.match(layout, /useProductFonts\(\)/);
  assert.doesNotMatch(layout, /if \(!fontsLoaded\)|fontsLoaded \? null/);
});

test('issue 120: router-rendered labels and headers receive product typography', async () => {
  const [tabs, onboarding, settings] = await Promise.all([
    renderLayoutOptions('app/(tabs)/_layout.tsx'),
    renderLayoutOptions('app/onboarding/_layout.tsx'),
    renderLayoutOptions('app/settings/_layout.tsx'),
  ]);

  assert.equal(tabs.tabBarLabelStyle.fontFamily, 'Figtree_500Medium');
  assert.equal(tabs.tabBarLabelStyle.fontSize, 11);
  for (const [name, options] of Object.entries({ tabs, onboarding, settings })) {
    assert.equal(options.headerTitleStyle.fontFamily, 'Nunito_700Bold', name);
    assert.equal(options.headerTitleStyle.fontSize, 28, name);
  }
});

test('issue 120: components consume the semantic typography roles', async () => {
  const t = await loadTypography();
  const button = read('design-system/components/PrimaryButton.tsx');
  const foodRow = read('design-system/components/FoodRow.tsx');

  assert.match(button, /typography\.control/);
  assert.doesNotMatch(button, /typography\.button/);
  assert.match(foodRow, /typography\.foodName/);
  assert.match(foodRow, /typography\.metadata/);
  assert.doesNotMatch(foodRow, /typography\.(?:bodyStrong|micro)/);
  assert.deepEqual(
    { fontSize: t.SystemTypography.metadata.fontSize, lineHeight: t.SystemTypography.metadata.lineHeight },
    { fontSize: 10, lineHeight: 13 },
  );
});

test('issue 120: no MacroFactor font file and OFL licences listed', () => {
  const walk = (d) =>
    existsSync(d)
      ? readdirSync(d, { withFileTypes: true }).flatMap((e) =>
          e.name === 'node_modules' || e.name.startsWith('.') ? [] : e.isDirectory() ? walk(join(d, e.name)) : [e.name],
        )
      : [];
  const files = walk(softwareRoot);
  assert.ok(!files.some((f) => /macrosans/i.test(f)), 'MacroSans font must not ship');
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies['@expo-google-fonts/figtree']);
  assert.ok(pkg.dependencies['@expo-google-fonts/nunito']);
  const lic = read('modules/app-core/settings/licenses.ts');
  assert.match(lic, /Figtree[^\n]*OFL-1\.1/);
  assert.match(lic, /Nunito[^\n]*OFL-1\.1/);
});

test('issue 120: no raw fontWeight left on Text styles (use theme.font)', () => {
  for (const p of ['app/(tabs)/today.tsx', 'design-system/components/FoodRow.tsx', 'design-system/components/ErrorBanner.tsx', 'design-system/components/OfflinePill.tsx', 'app/onboarding/ChoiceRow.tsx', 'design-system/components/MacroSummary.tsx']) {
    assert.doesNotMatch(read(p), /fontWeight:/, p);
  }
});
