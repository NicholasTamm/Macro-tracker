/**
 * M1-31 / #80 — semantic color tokens, theme-stable data domains, no raw banner hex.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '..');

async function loadColors() {
  const bundleDir = mkdtempSync(join(tmpdir(), 'macro-tracker-issue-80-'));
  try {
    writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
    const source = readFileSync(join(softwareRoot, 'design-system/tokens/colors.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    writeFileSync(join(bundleDir, 'colors.js'), compiled.outputText);
    return await import(pathToFileURL(join(bundleDir, 'colors.js')).href);
  } finally {
    rmSync(bundleDir, { recursive: true, force: true });
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const p = join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

test('palette exposes surface + state + overage tokens', async () => {
  const { lightPalette, darkPalette, DATA_DOMAIN_KEYS } = await loadColors();
  for (const key of [
    'canvas', 'band', 'tile', 'raised', 'control', 'divider', 'ink', 'muted', 'faint',
    'infoFill', 'successFill', 'warningFill', 'dangerFill', 'warningInk', 'overage',
    'energy', 'protein', 'fat', 'carbs', 'expenditure', 'weightTrend', 'danger',
  ]) {
    assert.equal(typeof lightPalette[key], 'string', `light missing ${key}`);
    assert.equal(typeof darkPalette[key], 'string', `dark missing ${key}`);
  }
  for (const key of DATA_DOMAIN_KEYS) {
    assert.equal(lightPalette[key], darkPalette[key], key);
  }
  assert.notEqual(lightPalette.overage, lightPalette.danger);
});

test('ThemeProvider applies persisted native appearance during startup and hides after hydration', async () => {
  const src = readFileSync(
    join(softwareRoot, 'design-system/theme/ThemeProvider.tsx'),
    'utf8',
  );
  const layout = readFileSync(join(softwareRoot, 'app/_layout.tsx'), 'utf8');
  const appConfig = JSON.parse(readFileSync(join(softwareRoot, 'app.json'), 'utf8'));
  const { lightPalette, darkPalette } = await loadColors();
  const splashConfig = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  )[1];
  assert.match(src, /expo-status-bar/);
  assert.match(src, /expo-navigation-bar/);
  assert.match(src, /expo-system-ui/);
  assert.match(src, /setNavigationButtonStyle: NavigationBar\.setButtonStyleAsync/);
  assert.match(src, /StatusBar/);
  assert.match(layout, /SplashScreen\.preventAutoHideAsync/);
  assert.match(layout, /if \(!ready\) return null/);
  assert.match(layout, /initializeNativeThemePreference\(SQLite\.openDatabaseSync, applyNativeThemePreference\)/);
  assert.match(layout, /applyNativeThemePreference\(themePreference\)/);
  assert.ok(
    layout.indexOf('initializeNativeThemePreference(SQLite.openDatabaseSync')
      < layout.indexOf('SplashScreen.preventAutoHideAsync'),
    'persisted appearance must be applied during module startup, before hydration',
  );
  assert.equal(splashConfig.backgroundColor, lightPalette.canvas);
  assert.equal(splashConfig.dark.backgroundColor, darkPalette.canvas);
});

test('screenshot parity rejects a collapsed surface role', async () => {
  const { assertRoleParity } = await import('./issue-80-screenshot-parity.mjs');
  const width = 390;
  const height = 1200;
  const solidImage = () => ({
    width,
    height,
    rgb: new Uint8Array(width * height * 3).fill(255),
  });
  const app = solidImage();
  const reference = solidImage();
  const referenceBandOffset = (1070 * width + Math.floor(width / 2)) * 3;
  reference.rgb.set([241, 241, 241], referenceBandOffset);

  assert.throws(
    () => assertRoleParity(width, 'light', app, reference),
    /light band role diverged/,
  );
});

test('native chrome uses contrasting Android navigation buttons at runtime', async () => {
  const source = readFileSync(
    join(softwareRoot, 'design-system/theme/nativeChrome.ts'),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
  const { syncNativeChrome } = await import(moduleUrl);
  const calls = [];
  const adapters = {
    setRootBackgroundColor: async (color) => { calls.push(['root', color]); },
    setNavigationButtonStyle: async (style) => { calls.push(['navigation', style]); },
  };

  await syncNativeChrome('android', 'dark', '#141414', adapters);
  await syncNativeChrome('android', 'light', '#f6f6f6', adapters);
  await syncNativeChrome('ios', 'dark', '#141414', adapters);

  assert.deepEqual(calls, [
    ['root', '#141414'],
    ['navigation', 'light'],
    ['root', '#f6f6f6'],
    ['navigation', 'dark'],
    ['root', '#141414'],
  ]);
});

const renderedSurfaceRoots = [
  'app',
  'modules',
  'design-system/components',
];

test('rendered surfaces do not embed raw hex/rgba (tokens only)', () => {
  const offenders = [];
  for (const root of renderedSurfaceRoots) {
    for (const p of walk(join(softwareRoot, root))) {
      if (!/\.(tsx|ts)$/.test(p)) continue;
      if (p.includes('__tests__')) continue;
      const source = readFileSync(p, 'utf8');
      if (/#[0-9a-fA-F]{3,8}/.test(source) || /rgba?\(/.test(source)) {
        offenders.push(p.replace(softwareRoot + '/', ''));
      }
    }
  }
  assert.deepEqual(offenders, [], `raw colors in rendered surfaces: ${offenders.join(', ')}`);
});

test('danger text is reserved for errors and destructive actions', () => {
  const expectedUses = {
    'app/(tabs)/today.tsx': 1,
    'app/onboarding/adult.tsx': 1,
    'app/settings/profile.tsx': 1,
    'design-system/components/ErrorBanner.tsx': 1,
    'design-system/components/PrimaryButton.tsx': 1,
    'modules/diary/entry-edit/DiaryEntryEditSheet.tsx': 1,
    'modules/diary/food-detail/FoodDetailSheet.tsx': 2,
  };
  const actualUses = {};
  for (const root of renderedSurfaceRoots) {
    for (const p of walk(join(softwareRoot, root))) {
      if (!/\.(tsx|ts)$/.test(p)) continue;
      if (p.includes('__tests__')) continue;
      const count = [...readFileSync(p, 'utf8').matchAll(/colors\.danger\b/g)].length;
      if (count > 0) actualUses[p.replace(softwareRoot + '/', '')] = count;
    }
  }
  assert.deepEqual(actualUses, expectedUses);
});
