/** Issue 77 production navigation and internal-route regression gates. */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
let bundleDir;

before(() => {
  bundleDir = mkdtempSync(join(softwareRoot, '.issue-77-navigation-'));
});

after(() => {
  rmSync(bundleDir, { recursive: true, force: true });
});

async function bundleRoute(relativePath, development, name) {
  const outfile = join(bundleDir, `${name}-${development ? 'dev' : 'prod'}.mjs`);
  await build({
    entryPoints: [join(softwareRoot, relativePath)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    define: { __DEV__: String(development) },
    external: ['react', 'react/jsx-runtime'],
    plugins: [{
      name: 'issue-77-navigation-stubs',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /^(expo-router|@expo\/vector-icons|@\/design-system)$/ },
          ({ path }) => ({ path, namespace: 'navigation-stub' }),
        );
        buildApi.onLoad({ filter: /.*/, namespace: 'navigation-stub' }, ({ path }) => {
          if (path === 'expo-router') {
            return {
              contents: `import React from 'react';
                export function Redirect(props) { return React.createElement('redirect', props); }
                export function Tabs(props) { return React.createElement('tabs', props); }
                Tabs.Screen = function Screen(props) { return React.createElement('screen', props); };`,
              loader: 'js',
            };
          }
          if (path === '@/design-system') {
            return {
              contents: `import React from 'react';
                export function ComponentGallery() { return React.createElement('gallery'); }
                export function useTheme() {
                  return { colors: { ink: '#000', muted: '#666', raised: '#fff', divider: '#ddd', canvas: '#fff' } };
                }`,
              loader: 'js',
            };
          }
          return {
            contents: 'export function Feather() { return null; } export function MaterialIcons() { return null; }',
            loader: 'js',
          };
        });
      },
    }],
  });
  return import(pathToFileURL(outfile).href);
}

async function tabScreens(development) {
  const { default: TabsLayout } = await bundleRoute(
    'app/(tabs)/_layout.tsx',
    development,
    'tabs-layout',
  );
  const children = TabsLayout().props.children;
  return new Map(children.map((child) => [child.props.name, child.props.options]));
}

test('production tab bar exposes only product-ready tabs with descriptive labels', async () => {
  const screens = await tabScreens(false);
  const visible = [...screens]
    .filter(([, options]) => options.href !== null)
    .map(([name]) => name);

  assert.deepEqual(visible, ['today', 'analytics', 'food-entry', 'settings']);
  assert.equal(screens.get('chat').href, null);
  assert.equal(screens.get('component-gallery').href, null);
  assert.deepEqual(
    visible.map((name) => screens.get(name).tabBarAccessibilityLabel),
    ['Today', 'Analytics', 'Search foods', 'Settings'],
  );
});

test('development tab bar intentionally exposes Gallery but never Chat', async () => {
  const screens = await tabScreens(true);
  const visible = [...screens]
    .filter(([, options]) => options.href !== null)
    .map(([name]) => name);

  assert.deepEqual(visible, ['today', 'analytics', 'food-entry', 'settings', 'component-gallery']);
  assert.equal(screens.get('component-gallery').href, '/component-gallery');
  assert.equal(screens.get('chat').href, null);
});

test('placeholder and production-only deep links redirect safely to Today', async () => {
  const { default: Chat } = await bundleRoute('app/(tabs)/chat.tsx', false, 'chat');
  const { default: ProductionGallery } = await bundleRoute(
    'app/(tabs)/component-gallery.tsx',
    false,
    'gallery',
  );
  const { default: DevelopmentGallery } = await bundleRoute(
    'app/(tabs)/component-gallery.tsx',
    true,
    'gallery',
  );

  assert.equal(Chat().props.href, '/today');
  assert.equal(ProductionGallery().props.href, '/today');
  assert.equal(DevelopmentGallery().type.name, 'ComponentGallery');
});
