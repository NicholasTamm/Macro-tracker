import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

let theme;
before(async () => {
  const result = await build({
    stdin: { contents: `export * from './design-system/theme/navigationTheme';
      export * from './design-system/tokens/colors';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', write: false,
    // Load installed navigation themes without importing its native UI host.
    plugins: [{ name: 'navigation-themes', setup(b) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'native', namespace: 'native' }));
      b.onLoad({ filter: /.*/, namespace: 'native' }, () => ({ contents: `export const Platform = { OS: 'web', select: x => x.web ?? x.default };` }));
      b.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: 'themes', namespace: 'themes' }));
      b.onLoad({ filter: /.*/, namespace: 'themes' }, () => ({
        contents: `export { DefaultTheme } from './node_modules/@react-navigation/native/lib/module/theming/DefaultTheme.js';
          export { DarkTheme } from './node_modules/@react-navigation/native/lib/module/theming/DarkTheme.js';`,
        resolveDir: process.cwd(),
      }));
    } }],
  });
  theme = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
});

for (const scheme of ['light', 'dark']) {
  test(`navigation maps every color to the active ${scheme} palette`, () => {
    const palette = theme.paletteFor(scheme);
    const actual = theme.navigationThemeFor(scheme, palette);
    assert.equal(actual.dark, scheme === 'dark');
    assert.deepEqual(actual.colors, {
      primary: palette.brand, background: palette.canvas, card: palette.raised,
      text: palette.ink, border: palette.divider, notification: palette.danger,
    });
    assert.ok(actual.fonts.regular, 'retain navigation font metadata');
    assert.ok(!Object.values(actual.colors).includes('rgb(216, 216, 216)'));
    assert.ok(!Object.values(actual.colors).includes('rgb(242, 242, 242)'));
  });
}

test('navigation uses the supplied palette rather than hardcoded scheme colors', () => {
  const palette = Object.fromEntries(Object.keys(theme.lightPalette).map(key => [key, `token:${key}`]));
  const actual = theme.navigationThemeFor('dark', palette);
  assert.equal(actual.colors.background, 'token:canvas');
  assert.equal(actual.colors.card, 'token:raised');
  assert.equal(actual.colors.text, 'token:ink');
  assert.equal(actual.colors.border, 'token:divider');
});

test('root navigation provider consumes the live app theme below persisted preferences', () => {
  const layout = readFileSync('app/_layout.tsx', 'utf8');
  const provider = readFileSync('components/NavigationThemeProvider.tsx', 'utf8');
  assert.match(layout, /<ThemeProvider forcedScheme=\{themePreference === 'system' \? undefined : themePreference\}>\s*<NavigationThemeProvider>\{children\}<\/NavigationThemeProvider>/);
  assert.match(provider, /import \{ ThemeProvider \} from '@react-navigation\/native'/);
  assert.match(provider, /const \{ scheme, colors \} = useTheme\(\)/);
  assert.match(provider, /useMemo\(\(\) => navigationThemeFor\(scheme, colors\), \[scheme, colors\]\)/);
  assert.match(provider, /<ThemeProvider value=\{theme\}>\{children\}<\/ThemeProvider>/);
});
