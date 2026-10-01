import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scanScript = fileURLToPath(new URL('./secret-scan.mjs', import.meta.url));

test('secret-scan exits 0 on clean tree (software/)', () => {
  const r = spawnSync(process.execPath, [scanScript], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('secret-scan detects ghp_ pattern in a temp file under software/', () => {
  const softwareRoot = fileURLToPath(new URL('..', import.meta.url));
  const dir = join(softwareRoot, 'scripts', '.tmp-secret-fixture');
  mkdirSync(dir, { recursive: true });
  const probe = join(dir, 'leak.env');
  writeFileSync(probe, 'TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n');
  try {
    const r = spawnSync(process.execPath, [scanScript], {
      cwd: softwareRoot,
      encoding: 'utf8',
    });
    assert.notEqual(r.status, 0, 'expected non-zero exit when secret present');
    assert.match(r.stderr + r.stdout, /github-pat|secret-scan FAILED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
