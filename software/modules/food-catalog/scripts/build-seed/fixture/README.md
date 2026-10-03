# Golden USDA-shaped fixture (M1-06)

Tiny CSV subset matching FoodData Central Foundation / SR Legacy download layout.

| Dataset | Foods | fdc_id |
| --- | --- | --- |
| `foundation/` | Eggs, Grade A, Large, egg whole | 748967 |
| `sr_legacy/` | Bananas, raw; Chicken breast raw | 173944, 171077 |

Values are copied from the pinned Oct 2024 Foundation and Apr 2018 SR Legacy public CSV archives (CC0). The sample_food hummus row in foundation `food.csv` is intentionally present so the Foundation/SR filter can be tested.

Default `build-seed.mjs` consumes this fixture. Set `USE_FULL_USDA=1` to download the pinned full archives instead (not required for CI/demo).
