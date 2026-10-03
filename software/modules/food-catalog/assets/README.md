# FoodSeed fixture assets (M1-09)

| File | Role |
| --- | --- |
| `FoodSeed.fixture.sqlite` | Tiny curated catalog (14 foods) for offline open/search until CDN (M1-20) |
| `seed-manifest.fixture.json` | Illustrative manifest for the fixture (not CDN-published) |

Regenerate from the selection pipeline:

```bash
cd software
node modules/food-catalog/scripts/build-seed/build-seed.mjs \
  --out /tmp/foodseed-fixture --seed-version fixture.m1-09.1
cp /tmp/foodseed-fixture/FoodSeed.sqlite \
  modules/food-catalog/assets/FoodSeed.fixture.sqlite
```

Then set `catalog_metadata.seed_version` to `fixture.m1-09.1` if needed.

Runtime: copy/open read-only via **expo-sqlite** on device; Node tests use **node-sqlite3-wasm** (FTS5). Stock **sql.js** can open the file for exact/getById but lacks FTS5 (repository falls back to LIKE).
