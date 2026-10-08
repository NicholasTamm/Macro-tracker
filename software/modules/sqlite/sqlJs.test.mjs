import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(moduleDir, '../..');
const bundleDir = mkdtempSync(join(tmpdir(), 'sqljs-wasm-url-'));
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
const originalBaseUrl = process.env.EXPO_BASE_URL;

function sqlJsMock(fail) {
  return {
    name: 'sql-js-mock',
    setup(builder) {
      builder.onResolve({ filter: /^sql\.js$/ }, () => ({
        path: 'sql.js',
        namespace: 'sql-js-mock',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'sql-js-mock' }, () => ({
        loader: 'js',
        contents: `
          export default async function initSqlJs(config) {
            globalThis.__sqlJsLocateUrls.push(
              config?.locateFile?.('sql-wasm-browser.wasm', '/current/route/') ?? null,
            );
            if (${JSON.stringify(fail)}) throw new Error('HTTP 404');
            return { Database: class Database { close() {} } };
          }
        `,
      }));
    },
  };
}

async function bundle(name, entryPoint, fail = false) {
  const outfile = join(bundleDir, `${name}.mjs`);
  await build({
    entryPoints: [join(softwareRoot, entryPoint)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    plugins: [sqlJsMock(fail)],
  });
  return import(pathToFileURL(outfile).href);
}

function setWebLocation(pathname) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL(pathname, 'https://tracker.example'),
  });
}

before(() => {
  globalThis.__sqlJsLocateUrls = [];
});

after(() => {
  rmSync(bundleDir, { recursive: true, force: true });
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
  else delete globalThis.location;
  if (originalBaseUrl === undefined) delete process.env.EXPO_BASE_URL;
  else process.env.EXPO_BASE_URL = originalBaseUrl;
  delete globalThis.__sqlJsLocateUrls;
});

test('WASM URL stays origin-absolute across root and nested routes', async () => {
  const { resolveSqlJsWasmUrl } = await bundle('resolver', 'modules/sqlite/sqlJs.ts');
  const expected = 'https://tracker.example/sql-wasm-browser.wasm';

  for (const route of ['/', '/settings/profile', '/settings/privacy/details']) {
    assert.equal(resolveSqlJsWasmUrl(`https://tracker.example${route}`), expected);
  }
  assert.equal(
    resolveSqlJsWasmUrl(
      'https://tracker.example/nutrition/settings/units',
      '/nutrition/',
    ),
    'https://tracker.example/nutrition/sql-wasm-browser.wasm',
  );
});

test('both database loaders use the shared stable WASM URL', async () => {
  process.env.EXPO_BASE_URL = '';
  globalThis.__sqlJsLocateUrls.length = 0;

  setWebLocation('/settings/profile');
  const userData = await bundle(
    'user-data',
    'modules/app-core/user-data/openSqlJs.ts',
  );
  (await userData.openSqlJsDatabase()).close();

  setWebLocation('/settings/licenses');
  const foodCatalog = await bundle(
    'food-catalog',
    'modules/food-catalog/local-food-repo/openSeed.ts',
  );
  (await foodCatalog.openSeedBytes(new Uint8Array())).close();

  assert.deepEqual(globalThis.__sqlJsLocateUrls, [
    'https://tracker.example/sql-wasm-browser.wasm',
    'https://tracker.example/sql-wasm-browser.wasm',
  ]);
});

test('missing WASM errors identify the affected storage boundary and URL', async () => {
  process.env.EXPO_BASE_URL = '/nutrition';
  setWebLocation('/nutrition/settings/about');

  const userData = await bundle(
    'user-data-failure',
    'modules/app-core/user-data/openSqlJs.ts',
    true,
  );
  await assert.rejects(
    userData.openSqlJsDatabase(),
    /Unable to initialize user data storage.*https:\/\/tracker\.example\/nutrition\/sql-wasm-browser\.wasm.*Verify the web WASM asset/s,
  );

  const foodCatalog = await bundle(
    'food-catalog-failure',
    'modules/food-catalog/local-food-repo/openSeed.ts',
    true,
  );
  await assert.rejects(
    foodCatalog.openSeedBytes(new Uint8Array()),
    /Unable to initialize food catalog storage.*https:\/\/tracker\.example\/nutrition\/sql-wasm-browser\.wasm.*Verify the web WASM asset/s,
  );
});
