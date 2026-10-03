import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

function moduleRootFromHere() {
  return join(__dirname, '../../..');
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value == null || Number.isNaN(value)) return 'NULL';
  return String(value);
}

const NUTRIENT_DEFS = [
  ['energy_kcal', 'Energy', 'kcal', 'kcal', 1, '208'],
  ['protein', 'Protein', 'Pro', 'g', 2, '203'],
  ['carbohydrate', 'Carbohydrate', 'Carb', 'g', 3, '205'],
  ['fat_total', 'Total fat', 'Fat', 'g', 4, '204'],
  ['fiber', 'Fiber', 'Fiber', 'g', 5, '291'],
  ['sugars_total', 'Total sugars', 'Sugar', 'g', 6, '269'],
  ['fat_saturated', 'Saturated fat', 'Sat', 'g', 7, '606'],
  ['fat_monounsaturated', 'Monounsaturated fat', 'Mono', 'g', 8, '645'],
  ['fat_polyunsaturated', 'Polyunsaturated fat', 'Poly', 'g', 9, '646'],
  ['fat_trans', 'Trans fat', 'Trans', 'g', 10, '605'],
  ['cholesterol', 'Cholesterol', 'Chol', 'mg', 11, '601'],
  ['sodium', 'Sodium', 'Na', 'mg', 12, '307'],
  ['potassium', 'Potassium', 'K', 'mg', 13, '306'],
  ['calcium', 'Calcium', 'Ca', 'mg', 14, '301'],
  ['iron', 'Iron', 'Fe', 'mg', 15, '303'],
  ['magnesium', 'Magnesium', 'Mg', 'mg', 16, '304'],
  ['phosphorus', 'Phosphorus', 'P', 'mg', 17, '305'],
  ['zinc', 'Zinc', 'Zn', 'mg', 18, '309'],
  ['vitamin_a_rae', 'Vitamin A (RAE)', 'VA', 'ug', 19, '320'],
  ['vitamin_c', 'Vitamin C', 'VC', 'mg', 20, '401'],
  ['vitamin_d', 'Vitamin D', 'VD', 'ug', 21, '328'],
  ['vitamin_e', 'Vitamin E', 'VE', 'mg', 22, '323'],
  ['vitamin_k', 'Vitamin K', 'VK', 'ug', 23, '430'],
  ['thiamin', 'Thiamin', 'B1', 'mg', 24, '404'],
  ['riboflavin', 'Riboflavin', 'B2', 'mg', 25, '405'],
  ['niacin', 'Niacin', 'B3', 'mg', 26, '406'],
  ['vitamin_b6', 'Vitamin B6', 'B6', 'mg', 27, '415'],
  ['folate_dfe', 'Folate (DFE)', 'Fol', 'ug', 28, '435'],
  ['vitamin_b12', 'Vitamin B12', 'B12', 'ug', 29, '418'],
  ['water', 'Water', 'H2O', 'g', 30, '255'],
  ['alcohol', 'Alcohol', 'Alc', 'g', 31, '221'],
];

/**
 * Build FoodSeed.sqlite via sqlite3 CLI (FTS5-capable) from food-seed-v1.sql + inserts.
 */
export async function emitSqliteCatalog(opts) {
  const {
    foods,
    pinnedSources,
    seedVersion,
    outDir,
    mode = 'fixture',
    retrievedAt = new Date().toISOString(),
    sourceOverrides = [],
  } = opts;

  const schemaPath = join(moduleRootFromHere(), 'schema/food-seed-v1.sql');
  const ddl = await readFile(schemaPath, 'utf8');

  const lines = [];
  lines.push('PRAGMA foreign_keys = ON;');
  lines.push('BEGIN;');

  const meta = [
    ['catalog_schema_version', '1'],
    ['seed_version', seedVersion],
    ['build_mode', mode],
    ['built_at', retrievedAt],
  ];
  for (const [k, v] of meta) {
    lines.push(
      `INSERT INTO catalog_metadata(key, value) VALUES (${sqlString(k)}, ${sqlString(v)});`,
    );
  }

  for (const [id, display, short, unit, order, usdaNbr] of NUTRIENT_DEFS) {
    lines.push(
      `INSERT INTO nutrient_definition(nutrient_id, display_name, short_name, canonical_unit, display_order, usda_nutrient_number) VALUES (${sqlString(id)}, ${sqlString(display)}, ${sqlString(short)}, ${sqlString(unit)}, ${order}, ${sqlString(usdaNbr)});`,
    );
  }

  const overrideById = new Map(sourceOverrides.map((s) => [s.sourceId, s]));
  const usedSourceIds = new Set(foods.map((f) => f.sourceId));

  for (const src of pinnedSources.sources) {
    if (!usedSourceIds.has(src.sourceId)) continue;
    const ov = overrideById.get(src.sourceId) || {};
    lines.push(
      `INSERT INTO source(source_id, display_name, release_version, release_date, retrieved_at, source_url, license_spdx, attribution_text, archive_sha256) VALUES (${[
        src.sourceId,
        src.displayName,
        ov.releaseVersion || src.releaseVersion,
        ov.releaseDate || src.releaseDate,
        ov.retrievedAt || retrievedAt,
        ov.sourceUrl || src.sourceUrl,
        src.licenseSpdx,
        src.attributionText,
        ov.archiveSha256 || src.archiveSha256,
      ]
        .map(sqlString)
        .join(', ')});`,
    );
  }

  let servingCount = 0;
  let nutrientValueCount = 0;

  for (const food of foods) {
    lines.push(
      `INSERT INTO food(food_id, source_id, external_id, data_type, description, normalized_name, category, scientific_name, state, edible_portion_pct, default_serving_id, source_modified_at, content_hash) VALUES (${sqlString(food.foodId)}, ${sqlString(food.sourceId)}, ${sqlString(food.externalId)}, ${sqlString(food.dataType)}, ${sqlString(food.description)}, ${sqlString(food.normalizedName)}, ${sqlString(food.category)}, ${sqlString(food.scientificName)}, ${sqlString(food.state)}, ${sqlNumber(food.ediblePortionPct)}, NULL, ${sqlString(food.sourceModifiedAt)}, ${sqlString(food.contentHash)});`,
    );

    for (const n of food.nutrients) {
      lines.push(
        `INSERT INTO food_nutrient(food_id, nutrient_id, amount_per_100g, derivation_code, min_value, max_value, data_points, source_nutrient_id) VALUES (${sqlString(food.foodId)}, ${sqlString(n.nutrientId)}, ${sqlNumber(n.amountPer100g)}, ${sqlString(n.derivationCode)}, ${sqlNumber(n.minValue)}, ${sqlNumber(n.maxValue)}, ${sqlNumber(n.dataPoints)}, ${sqlString(n.sourceNutrientId)});`,
      );
      nutrientValueCount += 1;
    }

    for (const s of food.servings) {
      lines.push(
        `INSERT INTO serving(food_id, sequence, quantity, unit, modifier, gram_weight, source_measure_id, is_default) VALUES (${sqlString(food.foodId)}, ${sqlNumber(s.sequence)}, ${sqlNumber(s.quantity)}, ${sqlString(s.unit)}, ${sqlString(s.modifier)}, ${sqlNumber(s.gramWeight)}, ${sqlString(s.sourceMeasureId)}, ${s.isDefault ? 1 : 0});`,
      );
      if (s.isDefault) {
        lines.push(
          `UPDATE food SET default_serving_id = last_insert_rowid() WHERE food_id = ${sqlString(food.foodId)};`,
        );
      }
      servingCount += 1;
    }

    for (const a of food.aliases) {
      lines.push(
        `INSERT INTO alias(food_id, alias, normalized_alias, locale, alias_type, rank_boost) VALUES (${sqlString(food.foodId)}, ${sqlString(a.alias)}, ${sqlString(a.normalizedAlias)}, ${sqlString(a.locale)}, ${sqlString(a.aliasType)}, ${sqlNumber(a.rankBoost)});`,
      );
    }

    const aliasText = food.aliases.map((a) => a.normalizedAlias).join(' ');
    lines.push(
      `INSERT INTO food_fts(food_id, name, aliases, category) VALUES (${sqlString(food.foodId)}, ${sqlString(food.normalizedName)}, ${sqlString(aliasText)}, ${sqlString(food.category || '')});`,
    );
  }

  lines.push(`
INSERT INTO build_validation(check_name, status, observed_value, expected_value, message)
SELECT 'fts_parity',
  CASE WHEN (SELECT COUNT(*) FROM food_fts) = (SELECT COUNT(*) FROM food) THEN 'pass' ELSE 'fail' END,
  CAST((SELECT COUNT(*) FROM food_fts) AS TEXT),
  CAST((SELECT COUNT(*) FROM food) AS TEXT),
  'food_fts rows must equal food rows';
`);
  lines.push(`
INSERT INTO build_validation(check_name, status, observed_value, expected_value, message)
SELECT 'required_macros',
  CASE WHEN (
    SELECT COUNT(*) FROM food AS f
    CROSS JOIN (
      SELECT 'energy_kcal' AS id UNION ALL SELECT 'protein'
      UNION ALL SELECT 'carbohydrate' UNION ALL SELECT 'fat_total'
    ) AS required
    LEFT JOIN food_nutrient AS n ON n.food_id = f.food_id AND n.nutrient_id = required.id
    WHERE n.food_id IS NULL
  ) = 0 THEN 'pass' ELSE 'fail' END,
  CAST((
    SELECT COUNT(*) FROM food AS f
    CROSS JOIN (
      SELECT 'energy_kcal' AS id UNION ALL SELECT 'protein'
      UNION ALL SELECT 'carbohydrate' UNION ALL SELECT 'fat_total'
    ) AS required
    LEFT JOIN food_nutrient AS n ON n.food_id = f.food_id AND n.nutrient_id = required.id
    WHERE n.food_id IS NULL
  ) AS TEXT),
  '0',
  'every food must have energy/protein/carb/fat';
`);

  lines.push('COMMIT;');

  await mkdir(outDir, { recursive: true });
  const dbPath = join(outDir, 'FoodSeed.sqlite');
  const insertPath = join(outDir, 'seed-inserts.sql');
  await writeFile(insertPath, `${lines.join('\n')}\n`);

  // Remove prior DB if present
  try {
    await unlink(dbPath);
  } catch {
    /* ok */
  }

  // Apply schema then inserts via sqlite3 (requires FTS5)
  const schemaTmp = join(outDir, '_schema.sql');
  await writeFile(schemaTmp, ddl);
  await execFileAsync('sqlite3', [dbPath, `.read ${schemaTmp}`]);
  await execFileAsync('sqlite3', [dbPath, `.read ${insertPath}`]);
  try { await unlink(schemaTmp); } catch { /* ok */ }

  const failCount = (
    await execFileAsync('sqlite3', [dbPath, "SELECT COUNT(*) FROM build_validation WHERE status='fail';"])
  ).stdout.trim();
  if (failCount !== '0') {
    const details = (await execFileAsync('sqlite3', [dbPath, 'SELECT check_name, observed_value, message FROM build_validation WHERE status=\"fail\";'])).stdout;
    throw new Error(`build validation failed:\n${details}`);
  }

  const buf = await readFile(dbPath);
  const dbSha = createHash('sha256').update(buf).digest('hex');
  const foodCount = foods.length;

  const sourcesMeta = pinnedSources.sources
    .filter((s) => usedSourceIds.has(s.sourceId))
    .map((s) => {
      const ov = overrideById.get(s.sourceId) || {};
      return {
        id: s.sourceId,
        release: ov.releaseVersion || s.releaseVersion,
        downloadURL: ov.sourceUrl || s.sourceUrl,
        retrievedAt: ov.retrievedAt || retrievedAt,
        archiveSHA256: ov.archiveSha256 || s.archiveSha256,
        license: s.licenseSpdx,
        attribution: s.attributionText,
      };
    });

  const manifest = {
    manifestVersion: 1,
    catalogSchemaVersion: 1,
    seedVersion,
    minimumAppBuild: 1,
    createdAt: retrievedAt,
    buildMode: mode,
    artifact: {
      url: `file://${dbPath}`,
      compression: 'none',
      compressedBytes: buf.length,
      uncompressedBytes: buf.length,
      sha256: dbSha,
      signature: '',
      signingKeyID: 'unsigned-local-build',
    },
    content: {
      foodCount,
      servingCount,
      nutrientValueCount,
      ftsDocumentCount: foodCount,
      locales: ['en'],
    },
    sources: sourcesMeta,
    releaseNotes: `M1-06 ${mode} seed build (${foodCount} foods)`,
    pinnedSourcesFile: 'pinned-sources.json',
  };

  const manifestPath = join(outDir, 'build-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const rowsPath = join(outDir, 'normalized-foods.json');
  await writeFile(rowsPath, `${JSON.stringify(foods, null, 2)}\n`);

  return { dbPath, manifestPath, rowsPath, manifest, byteLength: buf.length, insertPath };
}

/** Run a read-only sqlite3 query; returns stdout trimmed. */
export async function sqliteQuery(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', [dbPath, sql]);
  return stdout.trim();
}
