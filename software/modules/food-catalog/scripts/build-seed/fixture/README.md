# Golden USDA-shaped fixture (M1-06 / M1-07)

Tiny CSV subset matching FoodData Central Foundation / SR Legacy download layout.
Extended in M1-07 so the reviewed selection/alias/quota path can run offline.

| Dataset | Foods | Notes |
| --- | --- | --- |
| `foundation/` | Eggs, Grade A, Large, egg whole (`748967`) | Plus intentional `sample_food` hummus row for data-type filter tests |
| `sr_legacy/` | 13 staples | Includes raw/cooked chicken breast + brown rice pairs; covers quota categories |

Values are approximated from public USDA SR Legacy / Foundation figures (CC0) for offline CI.
They are **not** a substitute for a full pinned archive build (`USE_FULL_USDA=1` + `selection/selection.full.csv`).

Default `build-seed.mjs` consumes this fixture and applies `selection/selection.csv`.
