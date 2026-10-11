import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '../../..');
const bundleDir = join(__dirname, '.bundle');

let webExport;

before(async () => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  execFileSync(
    join(softwareRoot, 'node_modules/esbuild/bin/esbuild'),
    [
      join(__dirname, 'webExport.ts'),
      '--bundle',
      '--platform=node',
      '--format=esm',
      `--outfile=${join(bundleDir, 'webExport.js')}`,
    ],
    { cwd: softwareRoot, stdio: 'pipe' },
  );
  webExport = await import(pathToFileURL(join(bundleDir, 'webExport.js')).href);
});

const files = {
  json: '{"profile":{"id":"profile"}}\n',
  csv: '# section:profile\nid\nprofile\n',
  suggestedJsonName: 'macro-tracker-export-2026.json',
  suggestedCsvName: 'macro-tracker-export-2026.csv',
};

class TestBlob {
  constructor(parts, options = {}) {
    this.parts = parts;
    this.type = options.type ?? '';
  }
}

class TestFile extends TestBlob {
  constructor(parts, name, options = {}) {
    super(parts, options);
    this.name = name;
  }
}

function makeEnvironment(overrides = {}) {
  const anchors = [];
  const createdUrls = [];
  const revokedUrls = [];
  const environment = {
    Blob: TestBlob,
    File: TestFile,
    navigator: {},
    URL: {
      createObjectURL(blob) {
        const url = `blob:test-${createdUrls.length}`;
        createdUrls.push({ url, blob });
        return url;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
    document: {
      body: {
        appendChild() {},
      },
      createElement(tag) {
        assert.equal(tag, 'a');
        const anchor = {
          download: '',
          href: '',
          style: {},
          clicked: false,
          removed: false,
          click() {
            this.clicked = true;
          },
          remove() {
            this.removed = true;
          },
        };
        anchors.push(anchor);
        return anchor;
      },
    },
    ...overrides,
  };
  return { environment, anchors, createdUrls, revokedUrls };
}

test('uses Web Share only when both export files can be shared', async () => {
  let shareData;
  const state = makeEnvironment({
    navigator: {
      canShare(data) {
        assert.deepEqual(data.files.map((file) => file.name), [
          files.suggestedJsonName,
          files.suggestedCsvName,
        ]);
        return true;
      },
      async share(data) {
        shareData = data;
      },
    },
  });

  const result = await webExport.exportFilesViaWeb(files, state.environment);

  assert.deepEqual(result, { ok: true, method: 'web-share' });
  assert.equal(shareData.files[0].type, 'application/json');
  assert.equal(shareData.files[1].type, 'text/csv');
  assert.deepEqual(shareData.files[0].parts, [files.json]);
  assert.deepEqual(shareData.files[1].parts, [files.csv]);
  assert.equal(state.anchors.length, 0);
});

test('reports Web Share cancellation and allows a later retry', async () => {
  let attempts = 0;
  const state = makeEnvironment({
    navigator: {
      canShare: () => true,
      async share() {
        attempts += 1;
        if (attempts === 1) {
          throw new DOMException('cancelled', 'AbortError');
        }
      },
    },
  });

  assert.deepEqual(await webExport.exportFilesViaWeb(files, state.environment), {
    ok: false,
    reason: 'Export sharing was cancelled.',
  });
  assert.deepEqual(await webExport.exportFilesViaWeb(files, state.environment), {
    ok: true,
    method: 'web-share',
  });
});

test('offers separate JSON and CSV downloads when Web Share file support is unavailable', async () => {
  const state = makeEnvironment({
    navigator: {
      canShare: () => false,
      async share() {
        assert.fail('share should not be called');
      },
    },
  });

  const result = await webExport.exportFilesViaWeb(files, state.environment);

  assert.deepEqual(result, { ok: true, method: 'browser-download' });
  assert.equal(state.anchors.length, 0);

  assert.deepEqual(webExport.downloadExportFileViaWeb(files, 'json', state.environment), {
    ok: true,
    method: 'browser-download',
  });
  assert.deepEqual(webExport.downloadExportFileViaWeb(files, 'csv', state.environment), {
    ok: true,
    method: 'browser-download',
  });
  assert.deepEqual(state.anchors.map((anchor) => anchor.download), [
    files.suggestedJsonName,
    files.suggestedCsvName,
  ]);
  assert.ok(state.anchors.every((anchor) => anchor.clicked && anchor.removed));
  assert.deepEqual(state.createdUrls.map(({ blob }) => blob.type), [
    'application/json',
    'text/csv',
  ]);
  assert.deepEqual(state.createdUrls.map(({ blob }) => blob.parts[0]), [files.json, files.csv]);
  assert.deepEqual(state.revokedUrls, ['blob:test-0', 'blob:test-1']);
});

test('cleans up a failed individual download and can retry it', async () => {
  const state = makeEnvironment();
  let clicks = 0;
  const originalCreateElement = state.environment.document.createElement;
  state.environment.document.createElement = (tag) => {
    const anchor = originalCreateElement(tag);
    anchor.click = () => {
      clicks += 1;
      if (clicks === 1) throw new Error('download blocked');
      anchor.clicked = true;
    };
    return anchor;
  };

  assert.deepEqual(webExport.downloadExportFileViaWeb(files, 'csv', state.environment), {
    ok: false,
    reason: 'download blocked',
  });
  assert.ok(state.anchors.every((anchor) => anchor.removed));
  assert.deepEqual(state.revokedUrls, ['blob:test-0']);

  const retry = webExport.downloadExportFileViaWeb(files, 'csv', state.environment);
  assert.deepEqual(retry, { ok: true, method: 'browser-download' });
  assert.deepEqual(state.revokedUrls, ['blob:test-0', 'blob:test-1']);
});
