import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { syncWebWasm } from './sync-web-wasm.mjs';

const require = createRequire(import.meta.url);
const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fakeInstall() {
  const root = mkdtempSync(join(tmpdir(), 'web-wasm-'));
  const packageDir = join(root, 'node_modules', 'sql.js');
  const source = join(packageDir, 'dist', 'sql-wasm-browser.wasm');
  mkdirSync(dirname(source), { recursive: true });
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  writeFileSync(source, Buffer.from('package wasm'));
  return { root, source };
}

test('Metro preserves SQLite assets, bundles WASM, and sets isolation headers', () => {
  const config = require('../metro.config.js');
  assert.ok(config.resolver.assetExts.includes('sqlite'));
  assert.ok(config.resolver.assetExts.includes('wasm'));

  const headers = new Map();
  let reachedMetro = false;
  const middleware = config.server.enhanceMiddleware((_req, _res, next) => {
    reachedMetro = true;
    next();
  });
  middleware(
    {},
    { setHeader: (name, value) => headers.set(name, value) },
    () => {},
  );

  assert.equal(headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(headers.get('Cross-Origin-Embedder-Policy'), 'credentialless');
  assert.equal(reachedMetro, true);
});

test('syncWebWasm installs, verifies, and repairs the package-owned browser WASM', () => {
  const { root, source } = fakeInstall();
  const destination = join(root, 'public', 'sql-wasm-browser.wasm');
  try {
    const installed = syncWebWasm(root);
    assert.equal(installed.changed, true);
    assert.equal(installed.version, '1.2.3');
    assert.equal(sha256(destination), sha256(source));

    const mtime = statSync(destination).mtimeMs;
    assert.equal(syncWebWasm(root).changed, false);
    assert.equal(statSync(destination).mtimeMs, mtime);

    writeFileSync(destination, Buffer.from('stale wasm'));
    assert.equal(syncWebWasm(root).changed, true);
    assert.equal(sha256(destination), sha256(source));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('syncWebWasm fails clearly when the installed package asset is missing', () => {
  const { root, source } = fakeInstall();
  try {
    rmSync(source);
    assert.throws(
      () => syncWebWasm(root),
      /sql\.js 1\.2\.3 is missing .* Reinstall dependencies; web startup cannot continue/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the generated public WASM matches the installed sql.js version', () => {
  syncWebWasm(softwareRoot);
  const source = join(softwareRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm');
  const destination = join(softwareRoot, 'public', 'sql-wasm-browser.wasm');
  assert.equal(sha256(destination), sha256(source));
});
