-- Tiny demo fixture (not a production seed). Inserts one food + nutrients + FTS row.
INSERT INTO catalog_metadata(key, value) VALUES
  ('catalog_schema_version', '1'),
  ('seed_version', 'demo.fixture.1');

INSERT INTO source(
  source_id, display_name, release_version, release_date, retrieved_at,
  source_url, license_spdx, attribution_text, archive_sha256
) VALUES (
  'usda-foundation',
  'USDA Foundation Foods',
  'demo',
  '2026-09-28',
  '2026-09-28T00:00:00Z',
  'https://fdc.nal.usda.gov/',
  'CC0-1.0',
  'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.',
  '0000000000000000000000000000000000000000000000000000000000000000'
);

INSERT INTO nutrient_definition(nutrient_id, display_name, short_name, canonical_unit, display_order)
VALUES
  ('energy_kcal', 'Energy', 'kcal', 'kcal', 1),
  ('protein', 'Protein', 'Pro', 'g', 2),
  ('carbohydrate', 'Carbohydrate', 'Carb', 'g', 3),
  ('fat_total', 'Total fat', 'Fat', 'g', 4);

INSERT INTO food(
  food_id, source_id, external_id, data_type, description, normalized_name,
  category, content_hash
) VALUES (
  'usda-foundation:demo-egg',
  'usda-foundation',
  'demo-egg',
  'foundation',
  'Egg, whole, raw',
  'egg whole raw',
  'protein',
  'demo-content-hash'
);

INSERT INTO food_nutrient(food_id, nutrient_id, amount_per_100g) VALUES
  ('usda-foundation:demo-egg', 'energy_kcal', 143),
  ('usda-foundation:demo-egg', 'protein', 12.6),
  ('usda-foundation:demo-egg', 'carbohydrate', 0.7),
  ('usda-foundation:demo-egg', 'fat_total', 9.5);

INSERT INTO serving(food_id, sequence, quantity, unit, gram_weight, is_default)
VALUES ('usda-foundation:demo-egg', 1, 1, 'large', 50, 1);

UPDATE food SET default_serving_id = last_insert_rowid()
WHERE food_id = 'usda-foundation:demo-egg';

INSERT INTO food_fts(food_id, name, aliases, category)
VALUES ('usda-foundation:demo-egg', 'egg whole raw', 'eggs', 'protein');
