-- Food/diary-owned portion of UserData.sqlite DDL v1 (M1-local, mutable).
-- Profile, goals, targets, and coaching tables belong to the #13 user-model task.
-- Expo: expo-sqlite. No CloudKit / no remote sync in M1.
-- Stable IDs are application-generated UUID strings.
-- NULL nutrient amounts mean unavailable; never coerce missing to zero.
PRAGMA foreign_keys = ON;

CREATE TABLE schema_meta (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE custom_food (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    brand               TEXT,
    barcode_gtin14      TEXT CHECK (
                            barcode_gtin14 IS NULL OR
                            (length(barcode_gtin14) = 14 AND
                             barcode_gtin14 NOT GLOB '*[^0-9]*')
                        ),
    basis_kind          TEXT NOT NULL CHECK (basis_kind IN ('mass','volume','serving')),
    basis_amount        REAL NOT NULL CHECK (basis_amount > 0),
    basis_unit          TEXT NOT NULL,
    gram_weight_for_basis REAL CHECK (
                              gram_weight_for_basis IS NULL OR
                              gram_weight_for_basis > 0
                          ),
    nutrients_json      TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    is_archived         INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
    deleted_at          TEXT,
    sync_revision       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX custom_food_name_idx ON custom_food(name) WHERE deleted_at IS NULL;
CREATE INDEX custom_food_gtin_idx ON custom_food(barcode_gtin14) WHERE barcode_gtin14 IS NOT NULL;

CREATE TABLE meal_slot (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    sort_order          INTEGER NOT NULL,
    default_time        TEXT,
    is_archived         INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1))
);

CREATE TABLE diary_entry (
    id                  TEXT PRIMARY KEY,
    timestamp           TEXT NOT NULL,
    local_day_key       TEXT NOT NULL,
    timezone_identifier TEXT NOT NULL,
    meal_slot_id        TEXT REFERENCES meal_slot(id),
    food_kind           TEXT NOT NULL CHECK (food_kind IN ('seed','custom','off','fdc_branded','fatsecret')),
    food_stable_id      TEXT NOT NULL,
    food_provider_id    TEXT,
    food_gtin14         TEXT CHECK (
                            food_gtin14 IS NULL OR
                            (length(food_gtin14) = 14 AND
                             food_gtin14 NOT GLOB '*[^0-9]*')
                        ),
    food_display_name   TEXT NOT NULL,
    food_brand          TEXT,
    food_license_tag    TEXT NOT NULL,
    quantity            REAL NOT NULL CHECK (quantity > 0),
    unit_label          TEXT NOT NULL,
    grams               REAL CHECK (grams IS NULL OR grams > 0),
    nutrition_snapshot_json TEXT NOT NULL,
    source_display_name TEXT NOT NULL,
    source_url          TEXT,
    license_tag         TEXT NOT NULL,
    remote_terms_version TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT,
    sync_revision       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX diary_entry_day_idx ON diary_entry(local_day_key) WHERE deleted_at IS NULL;
CREATE INDEX diary_entry_ts_idx ON diary_entry(timestamp) WHERE deleted_at IS NULL;

CREATE TABLE diary_day_status (
    id                  TEXT PRIMARY KEY,
    local_day_key       TEXT NOT NULL UNIQUE,
    completeness        TEXT NOT NULL CHECK (completeness IN ('complete','partial','empty','unknown')),
    note                TEXT,
    updated_at          TEXT NOT NULL
);

CREATE TABLE favorite (
    id                  TEXT PRIMARY KEY,
    food_kind           TEXT NOT NULL CHECK (food_kind IN ('seed','custom','off','fdc_branded','fatsecret')),
    food_stable_id      TEXT NOT NULL,
    food_provider_id    TEXT,
    food_gtin14         TEXT CHECK (
                            food_gtin14 IS NULL OR
                            (length(food_gtin14) = 14 AND
                             food_gtin14 NOT GLOB '*[^0-9]*')
                        ),
    food_display_name   TEXT NOT NULL,
    food_brand          TEXT,
    food_license_tag    TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    UNIQUE (food_kind, food_stable_id)
);

CREATE TABLE recent_food (
    id                  TEXT PRIMARY KEY,
    food_kind           TEXT NOT NULL CHECK (food_kind IN ('seed','custom','off','fdc_branded','fatsecret')),
    food_stable_id      TEXT NOT NULL,
    food_provider_id    TEXT,
    food_gtin14         TEXT CHECK (
                            food_gtin14 IS NULL OR
                            (length(food_gtin14) = 14 AND
                             food_gtin14 NOT GLOB '*[^0-9]*')
                        ),
    food_display_name   TEXT NOT NULL,
    food_brand          TEXT,
    food_license_tag    TEXT NOT NULL,
    last_used_at        TEXT NOT NULL,
    use_count           INTEGER NOT NULL DEFAULT 1,
    last_quantity       REAL CHECK (last_quantity IS NULL OR last_quantity > 0),
    last_unit           TEXT,
    UNIQUE (food_kind, food_stable_id)
);

CREATE INDEX recent_food_used_idx ON recent_food(last_used_at DESC);

CREATE TABLE recipe (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    serving_count       REAL NOT NULL CHECK (serving_count > 0),
    ingredient_snapshots_json TEXT NOT NULL,
    totals_json         TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT,
    sync_revision       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE weight_sample (
    id                  TEXT PRIMARY KEY,
    timestamp           TEXT NOT NULL,
    kilograms           REAL NOT NULL CHECK (kilograms > 0),
    source              TEXT NOT NULL CHECK (source IN ('manual','health','import')),
    confirmed_outlier   INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_outlier IN (0,1)),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT,
    sync_revision       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX weight_sample_ts_idx ON weight_sample(timestamp) WHERE deleted_at IS NULL;

-- Device-local remote provider cache (separate from FoodSeed; TTL/policy enforced in adapters)
CREATE TABLE remote_food_cache (
    cache_key           TEXT PRIMARY KEY,
    provider            TEXT NOT NULL,
    external_id         TEXT NOT NULL,
    gtin14              TEXT CHECK (
                            gtin14 IS NULL OR
                            (length(gtin14) = 14 AND gtin14 NOT GLOB '*[^0-9]*')
                        ),
    response_json       BLOB,
    fetched_at          TEXT NOT NULL,
    expires_at          TEXT,
    persistence_policy  TEXT NOT NULL CHECK (
                            persistence_policy IN (
                                'durableWithAttribution',
                                'expires',
                                'identifiersOnly',
                                'noSharedCache'
                            )
                        ),
    terms_version       TEXT,
    etag                TEXT,
    last_accessed_at    TEXT NOT NULL,
    CHECK (persistence_policy <> 'expires' OR expires_at IS NOT NULL)
);

CREATE INDEX remote_cache_gtin_idx ON remote_food_cache(gtin14, provider);
CREATE INDEX remote_cache_expiry_idx ON remote_food_cache(expires_at);
