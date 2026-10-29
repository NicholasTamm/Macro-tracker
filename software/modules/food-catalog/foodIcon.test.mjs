import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const softwareRoot = join(here, '../..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');

async function load() {
  const dir = mkdtempSync(join(tmpdir(), 'macro-tracker-foodicon-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    const out = ts.transpileModule(readFileSync(join(here, 'foodIcon.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    writeFileSync(join(dir, 'foodIcon.js'), out);
    return await import(pathToFileURL(join(dir, 'foodIcon.js')).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('issue 121: maps common foods by keyword', async () => {
  const { foodIconFor } = await load();
  const cases = {
    'Bananas, raw': 'banana',
    'Apple, raw, with skin': 'red_apple',
    'Pineapple chunks': 'pineapple',
    'Egg, whole, boiled': 'egg',
    'Chicken breast, roasted': 'poultry_leg',
    'Avocado': 'avocado',
    'Rice, white, cooked': 'cooked_rice',
    'Bread, whole wheat': 'bread',
    'Milk, 2%': 'glass_of_milk',
    'Greek yogurt, plain': 'glass_of_milk',
    'Cheddar cheese': 'cheese_wedge',
    'Salmon, Atlantic, baked': 'fish',
    'Beef, ground, 90% lean': 'cut_of_meat',
    'Peanut butter, smooth': 'peanuts',
    'Butter, salted': 'butter',
    'Sweet potato, baked': 'potato',
    'Ice cream, vanilla': 'ice_cream',
    'Oatmeal': 'bowl_with_spoon',
    'Spaghetti, cooked': 'spaghetti',
    'Coffee, brewed': 'hot_beverage',
    'Orange juice': 'cup_with_straw',
    'Strawberries': 'strawberry',
    'Blueberries, raw': 'blueberries',
    'Broccoli, steamed': 'broccoli',
    'Lentils, boiled': 'beans',
    'Eggplant, grilled': 'leafy_green',
  };
  for (const [name, key] of Object.entries(cases)) {
    assert.equal(foodIconFor(name), key, name);
  }
});

test('issue 121: unknown foods fall back to the bowl, never empty', async () => {
  const { foodIconFor, FOOD_ICON_FALLBACK } = await load();
  assert.equal(FOOD_ICON_FALLBACK, 'bowl_with_spoon');
  for (const name of ['', 'Xyzzy protein bar', 'My custom thing', '🍽️']) {
    assert.equal(foodIconFor(name), 'bowl_with_spoon', JSON.stringify(name));
  }
  assert.equal(foodIconFor('Mystery', 'Fresh fruit: banana'), 'banana', 'category is consulted');
});

test('issue 121: every rule key has a bundled SVG asset and registry entry', async () => {
  const { FOOD_ICON_RULE_KEYS } = await load();
  const assets = read('design-system/components/foodIconAssets.ts');
  const files = new Set(readdirSync(join(softwareRoot, 'assets/food-icons')));
  for (const key of FOOD_ICON_RULE_KEYS) {
    assert.ok(files.has(`${key}.svg`), `assets/food-icons/${key}.svg`);
    assert.match(assets, new RegExp(`\\b${key}: require\\('../../assets/food-icons/${key}\\.svg'\\)`), key);
  }
  assert.ok(files.has('LICENSE-fluent-emoji.txt'));
  assert.match(read('assets/food-icons/LICENSE-fluent-emoji.txt'), /MIT License[\s\S]*Microsoft/);
  const registry = [...assets.matchAll(/^\s+(\w+): require\('..\/..\/assets\/food-icons\/(\w+)\.svg'\)/gm)];
  assert.ok(registry.length >= 30, `bundles ~30+ icons (${registry.length})`);
  for (const [, key, file] of registry) assert.equal(key, file, 'registry key equals file name');
});

test('issue 121: rows use the decorative FoodIcon instead of a system emoji', () => {
  const row = read('design-system/components/FoodRow.tsx');
  assert.doesNotMatch(row, /'🍽️'/, 'no default system emoji');
  assert.match(row, /<FoodIcon icon=\{icon\} size=\{32\} \/>/);
  assert.match(row, /width: 34/, '34 px slot unchanged');
  assert.match(row, /width: 44,\s*height: 44/, '44 pt action target unchanged');
  const icon = read('design-system/components/FoodIcon.tsx');
  assert.match(icon, /from 'expo-image'/);
  assert.match(icon, /accessibilityElementsHidden/);
  assert.match(icon, /importantForAccessibility="no-hide-descendants"/);
  assert.match(read('app/(tabs)/food-entry.tsx'), /icon=\{foodIconFor\(item\.name\)\}/);
  assert.match(read('app/(tabs)/today.tsx'), /<FoodIcon icon=\{foodIconFor\(entry\.foodDisplayName\)\} size=\{24\} \/>/);
  assert.match(read('modules/app-core/settings/licenses.ts'), /Fluent Emoji \(Microsoft\)', license: 'MIT'/);
  assert.ok(existsSync(join(softwareRoot, 'assets/food-icons/bowl_with_spoon.svg')));
});
