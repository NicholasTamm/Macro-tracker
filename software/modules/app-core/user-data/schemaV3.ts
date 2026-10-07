/** Bundled copy of modules/food-catalog/schema/user-store-v3-settings.sql. */
export const USER_STORE_V3_SETTINGS_SQL = `-- Additive M1-18 application settings table (user-store v3).
CREATE TABLE IF NOT EXISTS app_setting (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
` as string;
