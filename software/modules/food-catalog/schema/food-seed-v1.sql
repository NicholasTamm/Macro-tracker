-- FoodSeed.sqlite catalog DDL v1 (canonical)
-- Read-only at runtime; replacements are new artifacts, not in-place ALTER.
-- Expo: opened via expo-sqlite (or compatible adapter). FTS5 required.
PRAGMA foreign_keys = ON;

CREATE TABLE catalog_metadata (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE source (
    source_id           TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    release_version     TEXT NOT NULL,
    release_date        TEXT,
    retrieved_at        TEXT NOT NULL,
    source_url          TEXT NOT NULL,
    license_spdx        TEXT NOT NULL,
    attribution_text    TEXT NOT NULL,
    archive_sha256      TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE food (
    food_id             TEXT PRIMARY KEY,
    source_id           TEXT NOT NULL REFERENCES source(source_id),
    external_id         TEXT NOT NULL,
    data_type           TEXT NOT NULL CHECK (data_type IN ('foundation','sr_legacy')),
    description         TEXT NOT NULL,
    normalized_name     TEXT NOT NULL,
    category            TEXT,
    scientific_name     TEXT,
    state               TEXT,
    edible_portion_pct  REAL CHECK (edible_portion_pct IS NULL OR
                                     edible_portion_pct BETWEEN 0 AND 100),
    default_serving_id  INTEGER,
    source_modified_at  TEXT,
    content_hash        TEXT NOT NULL,
    UNIQUE (source_id, external_id)
);

CREATE INDEX food_source_idx ON food(source_id, external_id);
CREATE INDEX food_category_idx ON food(category);

CREATE TABLE nutrient_definition (
    nutrient_id         TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    short_name          TEXT NOT NULL,
    canonical_unit      TEXT NOT NULL CHECK
                         (canonical_unit IN ('kcal','g','mg','ug','IU')),
    display_order       INTEGER NOT NULL,
    healthkit_identifier TEXT,
    usda_nutrient_number TEXT,
    notes               TEXT
) WITHOUT ROWID;

CREATE TABLE food_nutrient (
    food_id             TEXT NOT NULL REFERENCES food(food_id) ON DELETE CASCADE,
    nutrient_id         TEXT NOT NULL REFERENCES nutrient_definition(nutrient_id),
    amount_per_100g     REAL NOT NULL CHECK (amount_per_100g >= 0),
    derivation_code     TEXT,
    min_value           REAL,
    max_value           REAL,
    data_points         INTEGER,
    source_nutrient_id  TEXT,
    PRIMARY KEY (food_id, nutrient_id)
) WITHOUT ROWID;

CREATE INDEX food_nutrient_by_nutrient_idx
    ON food_nutrient(nutrient_id, amount_per_100g);

CREATE TABLE serving (
    serving_id          INTEGER PRIMARY KEY,
    food_id             TEXT NOT NULL REFERENCES food(food_id) ON DELETE CASCADE,
    sequence            INTEGER NOT NULL,
    quantity            REAL NOT NULL CHECK (quantity > 0),
    unit                TEXT NOT NULL,
    modifier            TEXT,
    gram_weight         REAL NOT NULL CHECK (gram_weight > 0),
    source_measure_id   TEXT,
    is_default          INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
    UNIQUE (food_id, sequence)
);

CREATE INDEX serving_food_idx ON serving(food_id, sequence);

CREATE TABLE alias (
    alias_id            INTEGER PRIMARY KEY,
    food_id             TEXT NOT NULL REFERENCES food(food_id) ON DELETE CASCADE,
    alias               TEXT NOT NULL,
    normalized_alias    TEXT NOT NULL,
    locale              TEXT NOT NULL DEFAULT 'en',
    alias_type          TEXT NOT NULL CHECK
                         (alias_type IN ('source','generated','reviewed','regional')),
    rank_boost          REAL NOT NULL DEFAULT 0,
    UNIQUE (food_id, normalized_alias, locale)
);

CREATE INDEX alias_normalized_idx ON alias(normalized_alias, locale);

CREATE VIRTUAL TABLE food_fts USING fts5(
    food_id UNINDEXED,
    name,
    aliases,
    category,
    tokenize = 'unicode61 remove_diacritics 2 tokenchars ''-''',
    prefix = '2 3 4'
);

CREATE TABLE category_quota (
    category            TEXT PRIMARY KEY,
    selected_count      INTEGER NOT NULL,
    target_min          INTEGER NOT NULL,
    target_max          INTEGER NOT NULL,
    reviewer            TEXT,
    reviewed_at         TEXT
) WITHOUT ROWID;

CREATE TABLE build_validation (
    check_name          TEXT PRIMARY KEY,
    status              TEXT NOT NULL CHECK (status IN ('pass','warn','fail')),
    observed_value      TEXT,
    expected_value      TEXT,
    message             TEXT
) WITHOUT ROWID;
