/**
 * M1-21 accessibility / localization / privacy QA gates (static).
 * Device QA (VoiceOver/TalkBack, Dynamic Type, RTL on device) is recorded in
 * docs/m1-21-a11y-l10n-privacy-qa.md — these tests keep the automatable parts green.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(__dirname, '..');
const bundleDir = join(__dirname, '.bundle');
const UI_DIRS = ['app', 'components', 'design-system', 'modules'];

let colors;

before(async () => {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({ type: 'module' }));
  execFileSync(
    join(softwareRoot, 'node_modules/esbuild/bin/esbuild'),
    [
      join(softwareRoot, 'design-system/tokens/colors.ts'),
      '--bundle',
      '--platform=node',
      '--format=esm',
      `--outfile=${join(bundleDir, 'colors.js')}`,
    ],
    { cwd: softwareRoot, stdio: 'pipe' },
  );
  colors = await import(pathToFileURL(join(bundleDir, 'colors.js')).href);
});

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    if (f === 'node_modules' || f.startsWith('.')) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const tsxFiles = () =>
  UI_DIRS.flatMap((d) => walk(join(softwareRoot, d))).filter((p) => p.endsWith('.tsx'));
const rel = (p) => relative(softwareRoot, p);

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('WCAG AA text contrast for semantic tokens (light + dark)', () => {
  const surfaces = ['canvas', 'band', 'raised', 'control'];
  const failures = [];
  for (const scheme of ['light', 'dark']) {
    const p = colors.paletteFor(scheme);
    // Body text roles must hit 4.5:1 on every surface they sit on.
    for (const fg of ['ink', 'muted', 'danger']) {
      for (const bg of surfaces) {
        const r = contrast(p[fg], p[bg]);
        if (r < 4.5) failures.push(`${scheme} ${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    }
    // Primary button: raised label on ink fill.
    const btn = contrast(p.raised, p.ink);
    if (btn < 4.5) failures.push(`${scheme} raised on ink: ${btn.toFixed(2)}`);
    // Weight chart dots (non-text, WCAG 1.4.11) on band plot.
    const dot = contrast(p.weightTrend, p.band);
    if (dot < 3) failures.push(`${scheme} weightTrend on band: ${dot.toFixed(2)}`);
  }
  assert.deepEqual(failures, []);
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
    if (/https?:\/\/(?!fdc\.nal\.usda\.gov|www\.usda\.gov|creativecommons\.org)[^\s'"`]+/.test(s) && /fetch\(|XMLHttpRequest|axios/.test(s)) {
      offenders.push(rel(p));
    }
    if (/XMLHttpRequest|axios|navigator\.sendBeacon/.test(s)) offenders.push(rel(p));
  }
  assert.deepEqual([...new Set(offenders)], []);
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
