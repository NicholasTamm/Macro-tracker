import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @param {string} dbPath @param {string} sql */
export async function sqliteQuery(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', [dbPath, sql]);
  return stdout.trim();
}

/**
 * Load golden-queries.json (default next to build-seed root).
 * @param {string} [path]
 */
export async function loadGoldenQueries(path) {
  const p = path || join(__dirname, '../golden-queries.json');
  return JSON.parse(await readFile(p, 'utf8'));
}

/**
 * Run integrity / FK / schema / golden-query validations against an emitted FoodSeed.
 * Writes rows into build_validation and returns structured results.
 * Throws if any check has status 'fail'.
 *
 * @param {string} dbPath
 * @param {{ goldenQueriesPath?: string, skipGolden?: boolean }} [opts]
 */
export async function validateFoodSeed(dbPath, opts = {}) {
  /** @type {{ checkName: string, status: 'pass'|'warn'|'fail', observed: string, expected: string, message: string }[]} */
  const results = [];

  const push = (checkName, status, observed, expected, message) => {
    results.push({ checkName, status, observed: String(observed), expected: String(expected), message });
  };

  const integrity = await sqliteQuery(dbPath, 'PRAGMA integrity_check;');
  push(
    'integrity_check',
    integrity === 'ok' ? 'pass' : 'fail',
    integrity,
    'ok',
    'PRAGMA integrity_check must return ok',
  );

  const fk = await sqliteQuery(dbPath, 'PRAGMA foreign_key_check;');
  push(
    'foreign_key_check',
    fk === '' ? 'pass' : 'fail',
    fk === '' ? '0' : fk,
    '0',
    'PRAGMA foreign_key_check must be empty',
  );

  const foodCount = await sqliteQuery(dbPath, 'SELECT COUNT(*) FROM food;');
  const ftsCount = await sqliteQuery(dbPath, 'SELECT COUNT(*) FROM food_fts;');
  push(
    'fts_parity',
    foodCount === ftsCount ? 'pass' : 'fail',
    ftsCount,
    foodCount,
    'food_fts rows must equal food rows',
  );

  const missingMacros = await sqliteQuery(
    dbPath,
    `SELECT COUNT(*) FROM food AS f
    CROSS JOIN (
      SELECT 'energy_kcal' AS id UNION ALL SELECT 'protein'
      UNION ALL SELECT 'carbohydrate' UNION ALL SELECT 'fat_total'
    ) AS required
    LEFT JOIN food_nutrient AS n ON n.food_id = f.food_id AND n.nutrient_id = required.id
    WHERE n.food_id IS NULL`,
  );
  push(
    'required_macros',
    missingMacros === '0' ? 'pass' : 'fail',
    missingMacros,
    '0',
    'every food must have energy/protein/carb/fat',
  );

  const badDefaults = await sqliteQuery(
    dbPath,
    `SELECT COUNT(*) FROM food AS f
    LEFT JOIN serving AS s
      ON s.serving_id = f.default_serving_id AND s.food_id = f.food_id AND s.is_default = 1
    WHERE f.default_serving_id IS NOT NULL AND s.serving_id IS NULL`,
  );
  push(
    'default_serving_ownership',
    badDefaults === '0' ? 'pass' : 'fail',
    badDefaults,
    '0',
    'food.default_serving_id must point at same-food is_default=1 serving',
  );

  const schemaVersion = await sqliteQuery(
    dbPath,
    "SELECT value FROM catalog_metadata WHERE key='catalog_schema_version';",
  );
  push(
    'catalog_schema_version',
    schemaVersion === '1' ? 'pass' : 'fail',
    schemaVersion || '',
    '1',
    'catalog_metadata.catalog_schema_version must be 1',
  );

  const sourceCount = await sqliteQuery(dbPath, 'SELECT COUNT(*) FROM source;');
  push(
    'source_present',
    Number(sourceCount) >= 1 ? 'pass' : 'fail',
    sourceCount,
    '>=1',
    'at least one source row with attribution',
  );

  if (!opts.skipGolden) {
    const golden = await loadGoldenQueries(opts.goldenQueriesPath);
    for (const q of golden.queries || []) {
      const hitsRaw = await sqliteQuery(
        dbPath,
        `SELECT food_id FROM food_fts WHERE food_fts MATCH ${sqlString(q.match)} LIMIT 20;`,
      );
      const hits = hitsRaw ? hitsRaw.split('\n').filter(Boolean) : [];
      const expect = q.expectAnyFoodId || [];
      const ok = expect.some((id) => hits.includes(id));
      push(
        `golden:${q.id}`,
        ok ? 'pass' : 'fail',
        hits.join(',') || '(none)',
        expect.join('|'),
        q.notes || `golden query ${q.id} must hit expected food_id`,
      );
    }
  }

  // Persist into build_validation (replace prior rows for these names)
  const inserts = ['BEGIN;'];
  for (const r of results) {
    inserts.push(
      `INSERT OR REPLACE INTO build_validation(check_name, status, observed_value, expected_value, message) VALUES (${sqlString(r.checkName)}, ${sqlString(r.status)}, ${sqlString(r.observed)}, ${sqlString(r.expected)}, ${sqlString(r.message)});`,
    );
  }
  inserts.push('COMMIT;');
  await execFileAsync('sqlite3', [dbPath, inserts.join('\n')]);

  const failures = results.filter((r) => r.status === 'fail');
  if (failures.length) {
    const detail = failures.map((f) => `${f.checkName}: observed=${f.observed} expected=${f.expected} (${f.message})`).join('\n');
    const err = new Error(`FoodSeed validation failed (${failures.length}):\n${detail}`);
    err.code = 'SEED_VALIDATION_FAILED';
    err.results = results;
    throw err;
  }

  return { results, foodCount: Number(foodCount), ftsCount: Number(ftsCount) };
}
