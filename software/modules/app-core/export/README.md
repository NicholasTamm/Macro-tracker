# User-data export (M1-19)

Offline CSV + JSON export of user-owned data via the platform share sheet.

## Contents
- Provenance (exportedAt, schema/format versions)
- Profile, goals, targets
- Diary entries with **immutable nutrition snapshots** + per-entry source/license tags
- Weight samples
- Custom foods

Does **not** include shared `FoodSeed` catalog rows or remote provider caches.

## Share path
- Default: React Native `Share` (`shareExportViaPlatform`)
- Optional file URI: see `EXPO_FILE_SHARE_PATH_DOC` (expo-file-system + expo-sharing)
