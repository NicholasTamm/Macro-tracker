# food-catalog smoke demo (Issue #12)

Runnable on the Linux box (requires `sqlite3`, Node 20+, npm).

```bash
# from repo root
cd software
# npm ci   # if node_modules missing
bash modules/food-catalog/demo/smoke.sh
```

Expected: `SMOKE OK` after creating a 1-row FoodSeed fixture, empty UserData schema, and printing:

- `catalogSchemaVersion= 1`
- `required= energy_kcal,protein,carbohydrate,fat_total`
- `nutrientCount= 31`

This is the mandatory demo for the schema/contract MR (no full UI screen in #12).
