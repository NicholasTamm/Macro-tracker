import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_PARTS = ['node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm'];
const PACKAGE_PARTS = ['node_modules', 'sql.js', 'package.json'];
const DESTINATION_PARTS = ['public', 'sql-wasm-browser.wasm'];

function digest(path) {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

export function syncWebWasm(softwareRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const source = join(softwareRoot, ...SOURCE_PARTS);
  const packagePath = join(softwareRoot, ...PACKAGE_PARTS);
  const destination = join(softwareRoot, ...DESTINATION_PARTS);

  let version;
  try {
    version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
  } catch (error) {
    throw new Error(
      `Cannot read installed sql.js package metadata at ${packagePath}. Run npm install first.`,
      { cause: error },
    );
  }

  const sourceDigest = digest(source);
  if (!sourceDigest) {
    throw new Error(
      `sql.js ${version} is missing ${source}. Reinstall dependencies; web startup cannot continue.`,
    );
  }

  if (digest(destination) === sourceDigest) {
    return { changed: false, destination, source, version };
  }

  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    copyFileSync(source, temporary);
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }

  if (digest(destination) !== sourceDigest) {
    throw new Error(`Failed to synchronize sql.js ${version} WASM to ${destination}.`);
  }

  return { changed: true, destination, source, version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = syncWebWasm();
    const action = result.changed ? 'Synced' : 'Verified';
    console.log(`${action} sql.js ${result.version} WASM at ${result.destination}`);
  } catch (error) {
    console.error(`Web WASM setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
