# User-data export (M1-19)

Offline CSV + JSON export of user-owned data via the platform share sheet or browser downloads.

## Contents
- Provenance (exportedAt, schema/format versions)
- Profile, goals, targets
- Diary entries with **immutable nutrition snapshots** + per-entry source/license tags
- Weight samples
- Custom foods

Does **not** include shared `FoodSeed` catalog rows or remote provider caches.

## Share path
- Default: React Native `Share` (`shareExportViaPlatform`)
- Web: Web Share API when file sharing is supported, otherwise JSON + CSV downloads
- Optional file URI: see `EXPO_FILE_SHARE_PATH_DOC` (expo-file-system + expo-sharing)
