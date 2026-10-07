/**
 * M1-21 accessibility / localization / privacy QA gates (static).
 * Device QA (VoiceOver/TalkBack, Dynamic Type, RTL on device) is recorded in
 * docs/m1-21-a11y-l10n-privacy-qa.md — these tests keep the automatable parts green.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '..');
const bundleDir = join(__dirname, '.bundle');
const UI_DIRS = ['app', 'components', 'design-system', 'modules'];
const TEXT_SURFACE_TOKENS = ['ink', 'muted', 'danger'];
const TEXT_PAIRED_TOKENS = [
  ['raised', 'ink'],
  ['educationInk', 'education'],
];
const BANNER_TINTS = [
  ['info', 'rgba(91,149,243,0.12)'],
  ['success', 'rgba(70,174,116,0.12)'],
  ['warning', 'rgba(255,194,65,0.17)'],
  ['error', 'rgba(223,76,76,0.12)'],
];
const GATED_TEXT_TOKENS = new Set([
  ...TEXT_SURFACE_TOKENS,
  ...TEXT_PAIRED_TOKENS.map(([fg]) => fg),
]);
const TEXT_COLOR_PROPERTIES = new Set([
  'color',
  'placeholderTextColor',
  'headerTintColor',
  'tabBarActiveTintColor',
  'tabBarInactiveTintColor',
]);

let colors;

before(async () => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  const source = readFileSync(join(softwareRoot, 'design-system/tokens/colors.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(
    join(bundleDir, 'colors.js'),
    compiled.outputText,
  );
  colors = await import(pathToFileURL(join(bundleDir, 'colors.js')).href);
});

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const p = join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

const DIRECTIONAL_TEXT_GLYPH = /[‹›«»←→⟨⟩◀▶❮❯]/;

function directionalTextGlyphOffenders(path, source) {
  const offenders = [];
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function isRtlAware(node, expression) {
    for (let current = node.parent; current && current !== expression; current = current.parent) {
      if (
        ts.isConditionalExpression(current)
        && /\bI18nManager\.isRTL\b/.test(current.condition.getText(sourceFile))
      ) {
        return true;
      }
    }
    return false;
  }

  function inspectRenderedExpression(expression) {
    function inspect(node) {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        && DIRECTIONAL_TEXT_GLYPH.test(node.text)
        && !isRtlAware(node, expression)
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        offenders.push(`${path}:${line + 1}: ${node.text}`);
      }
      ts.forEachChild(node, inspect);
    }
    if (expression.expression) inspect(expression.expression);
  }

  function visit(node) {
    if (ts.isJsxText(node) && DIRECTIONAL_TEXT_GLYPH.test(node.text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      offenders.push(`${path}:${line + 1}: ${node.text.trim()}`);
    } else if (
      ts.isJsxExpression(node)
      && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      inspectRenderedExpression(node);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return offenders;
}

test('QA source walker tolerates concurrently removed directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-source-walk-'));
  const removed = join(root, 'removed');
  mkdirSync(removed);
  rmSync(removed, { recursive: true });
  try {
    assert.deepEqual(walk(removed), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const tsxFiles = () =>
  UI_DIRS.flatMap((d) => walk(join(softwareRoot, d))).filter((p) => p.endsWith('.tsx'));
const rel = (p) => relative(softwareRoot, p);

function textColorTokens(path) {
  const source = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  const tokens = new Set();

  function indexDeclarations(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, indexDeclarations);
  }

  function collectTokens(node, resolving = new Set()) {
    if (
      ts.isPropertyAccessExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'colors'
    ) {
      tokens.add(node.name.text);
      return;
    }
    if (ts.isIdentifier(node) && declarations.has(node.text) && !resolving.has(node.text)) {
      const nextResolving = new Set(resolving).add(node.text);
      collectTokens(declarations.get(node.text), nextResolving);
      return;
    }
    ts.forEachChild(node, (child) => collectTokens(child, resolving));
  }

  function propertyName(node) {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
    return undefined;
  }

  function findTextColors(node) {
    if (ts.isPropertyAssignment(node) && TEXT_COLOR_PROPERTIES.has(propertyName(node.name))) {
      collectTokens(node.initializer);
    }
    if (ts.isJsxAttribute(node) && TEXT_COLOR_PROPERTIES.has(node.name.text)) {
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        collectTokens(node.initializer.expression);
      }
    }
    ts.forEachChild(node, findTextColors);
  }

  indexDeclarations(sourceFile);
  findTextColors(sourceFile);
  return tokens;
}

const BUNDLED_ASSET_FETCH = {
  path: 'components/FoodCatalogProvider.tsx',
  line: 'const response = await fetch(uri);',
};

function networkCallOffenders(path, source) {
  const offenders = [];
  for (const match of source.matchAll(/\bfetch\s*\(/g)) {
    const lineNumber = source.slice(0, match.index).split('\n').length;
    const line = source.split('\n')[lineNumber - 1].trim();
    if (path !== BUNDLED_ASSET_FETCH.path || line !== BUNDLED_ASSET_FETCH.line) {
      offenders.push(`${path}:${lineNumber} fetch`);
    }
  }
  if (/XMLHttpRequest|axios|navigator\.sendBeacon/.test(source)) {
    offenders.push(`${path} disallowed network client`);
  }
  return offenders;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function composite(foreground, background) {
  const match = foreground.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/,
  );
  assert.ok(match, `expected rgba color, received ${foreground}`);
  const alpha = Number(match[4]);
  const backgroundHex = background.replace('#', '');
  const backgroundChannels = [0, 2, 4].map((offset) =>
    parseInt(backgroundHex.slice(offset, offset + 2), 16),
  );
  const channels = match.slice(1, 4).map((channel, index) =>
    Math.round(Number(channel) * alpha + backgroundChannels[index] * (1 - alpha)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('every text color token is registered in the contrast gate', () => {
  const used = new Set();
  for (const p of tsxFiles()) {
    for (const token of textColorTokens(p)) used.add(token);
  }
  assert.deepEqual(
    [...used].filter((token) => !GATED_TEXT_TOKENS.has(token)).sort(),
    [],
    `ungated text foreground tokens: ${[...used].filter((token) => !GATED_TEXT_TOKENS.has(token)).sort().join(', ')}`,
  );
  assert.deepEqual([...used].sort(), [...GATED_TEXT_TOKENS].sort());
});

test('interactive control boundaries use the non-text contrast token', () => {
  let inputCount = 0;
  for (const p of tsxFiles()) {
    const source = readFileSync(p, 'utf8');
    for (const match of source.matchAll(/<TextInput\b[\s\S]*?\/>/g)) {
      inputCount += 1;
      assert.match(match[0], /borderColor:\s*colors\.controlBorder/, rel(p));
    }
  }
  assert.ok(inputCount > 0, 'expected to audit at least one text input');

  const choice = readFileSync(join(softwareRoot, 'app/onboarding/ChoiceRow.tsx'), 'utf8');
  assert.match(choice, /selected\s*\?\s*colors\.ink\s*:\s*colors\.controlBorder/);

  const button = readFileSync(
    join(softwareRoot, 'design-system/components/PrimaryButton.tsx'),
    'utf8',
  );
  assert.match(button, /variant === 'secondary'\s*\?\s*colors\.controlBorder/);
});

test('WCAG AA text and non-text contrast for semantic tokens (light + dark)', () => {
  const surfaces = ['canvas', 'band', 'raised', 'control'];
  const failures = [];
  for (const scheme of ['light', 'dark']) {
    const p = colors.paletteFor(scheme);
    // Every text role used on general app surfaces must hit 4.5:1.
    for (const fg of TEXT_SURFACE_TOKENS) {
      for (const bg of surfaces) {
        const r = contrast(p[fg], p[bg]);
        if (r < 4.5) failures.push(`${scheme} ${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    }
    // Remaining text roles have a single, intentional background pairing.
    for (const [fg, bg] of TEXT_PAIRED_TOKENS) {
      const r = contrast(p[fg], p[bg]);
      if (r < 4.5) failures.push(`${scheme} ${fg} on ${bg}: ${r.toFixed(2)}`);
    }
    // ErrorBanner tint colors are translucent, so measure their rendered color
    // after compositing over the canvas where banners are placed.
    for (const [tone, tint] of BANNER_TINTS) {
      const background = composite(tint, p.canvas);
      const r = contrast(p.ink, background);
      if (r < 4.5) failures.push(`${scheme} ink on ${tone} banner: ${r.toFixed(2)}`);
    }
    // Interactive control boundaries (WCAG 1.4.11) must remain visible on
    // both app and elevated surfaces; decorative dividers are intentionally separate.
    for (const bg of ['canvas', 'raised']) {
      const r = contrast(p.controlBorder, p[bg]);
      if (r < 3) failures.push(`${scheme} controlBorder on ${bg}: ${r.toFixed(2)}`);
    }
    // Weight chart dots (non-text, WCAG 1.4.11) on band plot.
    const dot = contrast(p.weightTrend, p.band);
    if (dot < 3) failures.push(`${scheme} weightTrend on band: ${dot.toFixed(2)}`);
  }
  assert.deepEqual(failures, []);
});

test('ErrorBanner text uses the foregrounds gated for every banner background', () => {
  const source = readFileSync(
    join(softwareRoot, 'design-system/components/ErrorBanner.tsx'),
    'utf8',
  );
  assert.match(source, /const textColor = tone === 'education' \? colors\.educationInk : colors\.ink/);
  assert.match(source, /typography\.caption, \{ color: textColor, marginTop: 2 \}/);
  for (const [tone, tint] of BANNER_TINTS) {
    assert.ok(source.includes(`'${tint}'`), `${tone} banner tint is not contrast-gated`);
  }
});

test('no camera / mic / location permissions declared; sensitive ones blocked', () => {
  const app = JSON.parse(readFileSync(join(softwareRoot, 'app.json'), 'utf8')).expo;
  const declared = JSON.stringify({
    ios: app.ios?.infoPlist ?? {},
    androidPermissions: app.android?.permissions ?? [],
    plugins: app.plugins ?? [],
  });
  assert.doesNotMatch(
    declared,
    /CAMERA|RECORD_AUDIO|LOCATION|NSCameraUsage|NSMicrophoneUsage|NSLocation|expo-camera|expo-av|expo-location|expo-image-picker|expo-barcode-scanner/i,
  );
  const blocked = app.android?.blockedPermissions ?? [];
  for (const perm of ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
    assert.ok(blocked.includes(`android.permission.${perm}`), `blockedPermissions missing ${perm}`);
  }
  const pkg = JSON.parse(readFileSync(join(softwareRoot, 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const banned = deps.filter((d) =>
    /^(expo-camera|expo-av|expo-audio|expo-location|expo-image-picker|expo-barcode-scanner|expo-tracking-transparency|@react-native-firebase\/analytics|@segment\/|@amplitude\/|mixpanel|posthog|@sentry\/)/.test(d),
  );
  assert.deepEqual(banned, [], 'camera/mic/location/analytics deps must not ship in M1');
});

test('no network calls to remote hosts from app/runtime code', () => {
  const offenders = [];
  const src = UI_DIRS.flatMap((d) => walk(join(softwareRoot, d))).filter(
    (p) => /\.(ts|tsx)$/.test(p) && !p.includes('/scripts/build-seed/'),
  );
  for (const p of src) {
    const s = readFileSync(p, 'utf8');
    offenders.push(...networkCallOffenders(rel(p), s));
  }
  assert.deepEqual([...new Set(offenders)], []);
});

test('network gate rejects computed fetches and only allows the bundled asset fetch', () => {
  assert.deepEqual(
    networkCallOffenders('modules/example.ts', 'fetch(config.apiUrl);'),
    ['modules/example.ts:1 fetch'],
  );
  assert.deepEqual(
    networkCallOffenders(BUNDLED_ASSET_FETCH.path, BUNDLED_ASSET_FETCH.line),
    [],
  );
  assert.deepEqual(
    networkCallOffenders(
      BUNDLED_ASSET_FETCH.path,
      `${BUNDLED_ASSET_FETCH.line}\nfetch(config.apiUrl);`,
    ),
    [`${BUNDLED_ASSET_FETCH.path}:2 fetch`],
  );
});

test('RTL: layout uses start/end, not hard-coded left/right', () => {
  const offenders = [];
  const re = /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor|left|right)\s*:/g;
  for (const p of tsxFiles()) {
    readFileSync(p, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (re.test(line)) offenders.push(`${rel(p)}:${i + 1}: ${line.trim()}`);
        re.lastIndex = 0;
      });
  }
  assert.deepEqual(offenders, []);
});

test('RTL: directional icon names are selected for the active direction', () => {
  const offenders = [];
  const directionalIcon = /(?:arrow|chevron|caret|navigate).*(?:left|right|back|forward|next|before)|(?:left|right|back|forward|next|before).*(?:arrow|chevron|caret|navigate)/;
  for (const p of tsxFiles()) {
    const source = readFileSync(p, 'utf8');
    const sourceFile = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function findHardCodedNames(node) {
      if (ts.isJsxAttribute(node) && node.name.text === 'name') {
        const value = ts.isStringLiteral(node.initializer)
          ? node.initializer.text
          : node.initializer
            && ts.isJsxExpression(node.initializer)
            && node.initializer.expression
            && ts.isStringLiteral(node.initializer.expression)
              ? node.initializer.expression.text
              : undefined;
        if (value && directionalIcon.test(value)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          offenders.push(`${rel(p)}:${line + 1}: ${value}`);
        }
      }
      ts.forEachChild(node, findHardCodedNames);
    }
    findHardCodedNames(sourceFile);
  }
  assert.deepEqual(offenders, []);

  const settings = readFileSync(join(softwareRoot, 'app/(tabs)/settings.tsx'), 'utf8');
  assert.match(
    settings,
    /name=\{I18nManager\.isRTL \? 'chevron-left' : 'chevron-right'\}/,
  );
});

test('RTL: directional text glyphs are selected for the active direction', () => {
  assert.deepEqual(
    directionalTextGlyphOffenders('example.tsx', "// <Text>‹</Text>\n<Text>{I18nManager.isRTL ? '›' : '‹'}</Text>"),
    [],
  );
  assert.deepEqual(
    directionalTextGlyphOffenders('example.tsx', "<Text>{delta < 0 ? '‹' : '›'}</Text>"),
    ['example.tsx:1: ‹', 'example.tsx:1: ›'],
  );

  const offenders = tsxFiles().flatMap((p) =>
    directionalTextGlyphOffenders(rel(p), readFileSync(p, 'utf8')),
  );
  assert.deepEqual(offenders, []);
});

test('Reduce Motion: modals do not force slide animation', () => {
  const offenders = [];
  for (const p of tsxFiles()) {
    const s = readFileSync(p, 'utf8');
    if (/animationType="(slide|fade)"/.test(s)) offenders.push(rel(p));
    if (/\bAnimated\.|react-native-reanimated|LayoutAnimation/.test(s) && !/useReduceMotion|useReducedMotion/.test(s)) {
      offenders.push(`${rel(p)} (animation without Reduce Motion gate)`);
    }
  }
  assert.deepEqual(offenders, []);
  const hook = readFileSync(join(softwareRoot, 'design-system/theme/useReduceMotion.ts'), 'utf8');
  assert.match(hook, /isReduceMotionEnabled/);
  assert.match(hook, /reduceMotionChanged/);
  assert.match(hook, /useState<boolean \| null>\(null\)/);
  assert.match(hook, /reduceMotion === false \? 'slide' : 'none'/);
});

/** Opening-tag scan: every interactive control needs a spoken name (+ role for pressables). */
test('screen reader: interactive controls have labels and roles', () => {
  const offenders = [];
  for (const p of tsxFiles()) {
    const s = readFileSync(p, 'utf8');
    for (const tag of ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TextInput', 'Switch']) {
      const re = new RegExp(`<${tag}\\b`, 'g');
      let m;
      while ((m = re.exec(s))) {
        let i = m.index;
        let depth = 0;
        for (; i < s.length; i++) {
          const c = s[i];
          if (c === '{') depth++;
          else if (c === '}') depth--;
          else if (c === '>' && depth === 0 && s[i - 1] !== '=') break;
        }
        const open = s.slice(m.index, i);
        const spread = /\{\.\.\.(rest|props)\}/.test(open);
        const hasLabel = spread || /accessibilityLabel/.test(open);
        const hasRole = spread || tag === 'TextInput' || /accessibilityRole/.test(open);
        if (!hasLabel || !hasRole) {
          const line = s.slice(0, m.index).split('\n').length;
          offenders.push(`${rel(p)}:${line} <${tag}> ${hasLabel ? '' : 'no label '}${hasRole ? '' : 'no role'}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('QA report exists and records zero open critical findings', () => {
  const report = readFileSync(
    join(softwareRoot, '../docs/m1-21-a11y-l10n-privacy-qa.md'),
    'utf8',
  );
  assert.match(report, /Open critical findings: \*\*0\*\*/);
  for (const h of ['Contrast', 'Reduce Motion', 'RTL', 'Privacy', 'Screen reader']) {
    assert.ok(report.includes(h), `report missing section ${h}`);
  }
});
