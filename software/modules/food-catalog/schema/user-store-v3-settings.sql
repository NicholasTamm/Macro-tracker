-- Additive M1-18 application settings table (user-store v3).
-- Applied after user-store-v2-profile.sql; migrate.ts updates schema_meta to 3.
CREATE TABLE IF NOT EXISTS app_setting (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
