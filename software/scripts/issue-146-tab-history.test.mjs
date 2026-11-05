/** Exercise the production Tabs config with the installed React Navigation router. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TabRouter, TabActions } from '@react-navigation/routers';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let temp;
before(() => { temp = mkdtempSync(join(root, '.issue-146-')); });
after(() => { rmSync(temp, { recursive: true, force: true }); });
async function tabsConfig(platform) {
  const outfile = join(temp, `${platform}.mjs`);
  await build({
    entryPoints: [join(root, 'app/(tabs)/_layout.tsx')], outfile,
    bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'], define: { __DEV__: 'false' },
    plugins: [{
      name: 'tab-layout-ui',
      setup(api) {
        api.onResolve({ filter: /^(expo-router|react-native|@expo\/vector-icons|@\/design-system)$/ },
          ({ path }) => ({ path, namespace: 'ui' }));
        api.onLoad({ filter: /.*/, namespace: 'ui' }, ({ path }) => ({ loader: 'js', contents:
          path === 'react-native' ? `export const Platform = { OS: ${JSON.stringify(platform)} };` :
          path === 'expo-router' ? `export const Tabs = Object.assign(() => null, { Screen: () => null });` :
          path === '@/design-system' ? `export const useTheme = () => ({ colors: {}, typography: {} });` :
          `export const Feather = () => null, MaterialIcons = () => null;`,
        }));
      },
    }],
  });
  const { default: Layout } = await import(pathToFileURL(outfile).href);
  return Layout().props;
}
function deepLinkedSettings(config) {
  const routeNames = config.children.filter(Boolean).map((child) => child.props.name);
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const router = TabRouter(config);
  const state = router.getRehydratedState({ routes: [{ name: 'settings' }], index: 0 }, options);
  return { router, state, options };
}

test('deep-linked Settings → browser-restored Settings → Today appends tab history instead of popping', async () => {
  const config = await tabsConfig('web');
  const { router, state: settings, options } = deepLinkedSettings(config);
  // The browser restores this saved tab state after returning from the root
  // Settings stack. Expo maps a negative tab-history delta to history.go(delta).
  const restored = router.getRehydratedState(structuredClone(settings), options);
  const today = router.getStateForAction(restored, TabActions.jumpTo('today'), options);
  assert.equal(today.routes[today.index].name, 'today');
  assert.equal(today.history.length - restored.history.length, 1,
    'a Today tab press must push a browser entry, never synthesize a Back');
  assert.equal(settings.history.length, 1, 'deep link must not invent an unvisited Today entry');
});

test('web repeated tab visits append without deduplication, and Back restores visited tabs', async () => {
  const { router, state: initial, options } = deepLinkedSettings(await tabsConfig('web'));
  let state = initial;
  const visits = ['today', 'settings', 'analytics', 'today', 'food-entry', 'settings'];
  for (const name of visits) {
    const next = router.getStateForAction(state, TabActions.jumpTo(name), options);
    assert.equal(next.history.length, state.history.length + 1, name);
    state = next;
  }
  // Re-selecting the focused tab does not create a duplicate browser entry.
  assert.equal(router.getStateForAction(state, TabActions.jumpTo('settings'), options).history.length, state.history.length);
  for (const name of ['food-entry', 'today', 'analytics', 'settings', 'today', 'settings']) {
    state = router.getStateForAction(state, { type: 'GO_BACK' }, options);
    assert.equal(state.routes[state.index].name, name);
  }
  assert.equal(router.getStateForAction(state, { type: 'GO_BACK' }, options), null);
});

for (const platform of ['ios', 'android']) {
  test(`${platform} retains the existing first-route Back behavior`, async () => {
    const { router, state, options } = deepLinkedSettings(await tabsConfig(platform));
    const back = router.getStateForAction(state, { type: 'GO_BACK' }, options);
    assert.equal(back.routes[back.index].name, 'today');
  });
}
