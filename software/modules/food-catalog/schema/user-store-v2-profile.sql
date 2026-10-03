-- Additive M1-10 profile / goal / starter-target tables (user-store v2).
-- Applied after user-store-v1.sql; bumps schema_meta.user_store_version to 2.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_profile (
    id                      TEXT PRIMARY KEY,
    is_adult_confirmed      INTEGER NOT NULL DEFAULT 0 CHECK (is_adult_confirmed IN (0,1)),
    adult_confirmed_at      TEXT,
    mass_unit               TEXT NOT NULL DEFAULT 'kg' CHECK (mass_unit IN ('kg','lb')),
    height_unit             TEXT NOT NULL DEFAULT 'cm' CHECK (height_unit IN ('cm','in')),
    energy_unit             TEXT NOT NULL DEFAULT 'kcal' CHECK (energy_unit IN ('kcal','kJ')),
    sex                     TEXT CHECK (
                                sex IS NULL OR sex IN ('female','male','other','unspecified')
                            ),
    birth_year              INTEGER CHECK (
                                birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= 2100)
                            ),
    height_cm               REAL CHECK (height_cm IS NULL OR height_cm > 0),
    weight_kg               REAL CHECK (weight_kg IS NULL OR weight_kg > 0),
    exclusions_json         TEXT NOT NULL DEFAULT '[]',
    onboarding_step         TEXT NOT NULL DEFAULT 'adult',
    onboarding_completed_at TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    sync_revision           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_goal (
    id                      TEXT PRIMARY KEY,
    profile_id              TEXT NOT NULL REFERENCES user_profile(id),
    goal_kind               TEXT NOT NULL CHECK (goal_kind IN ('lose','gain','maintain')),
    rate_kg_per_week        REAL CHECK (rate_kg_per_week IS NULL OR rate_kg_per_week >= 0),
    is_active               INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    sync_revision           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS user_goal_profile_idx ON user_goal(profile_id) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS daily_target (
    id                      TEXT PRIMARY KEY,
    profile_id              TEXT NOT NULL REFERENCES user_profile(id),
    energy_kcal             REAL NOT NULL CHECK (energy_kcal > 0),
    protein_g               REAL NOT NULL CHECK (protein_g >= 0),
    carbohydrate_g          REAL NOT NULL CHECK (carbohydrate_g >= 0),
    fat_g                   REAL NOT NULL CHECK (fat_g >= 0),
    source                  TEXT NOT NULL DEFAULT 'starter' CHECK (
                                source IN ('starter','manual','coaching')
                            ),
    effective_from          TEXT NOT NULL,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    sync_revision           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS daily_target_profile_idx ON daily_target(profile_id, effective_from DESC);
