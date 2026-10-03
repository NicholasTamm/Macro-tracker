# Seed selection, aliases, and category quotas (M1-07)

Reviewed, file-based inputs consumed by the M1-06 pipeline **after** normalize and
**before** final FoodSeed packaging (M1-08). Nothing here is hard-coded into emit.

## Files

| File | Role |
| --- | --- |
| `category-quotas.json` | Per-category `targetMin`/`targetMax` for fixture and full modes |
| `selection.csv` | Reviewed `food_id` list for the golden/fixture path |
| `selection.full.csv` | Optional reviewed list for `USE_FULL_USDA=1` (gitignored if huge; template below) |
| `aliases-overrides.csv` | Reviewed alias overrides (`food_id`, alias, locale, type, boost, reason, reviewer) |
| `raw-cooked-pairs.csv` | Staple pairs that must both survive when both are selected |

## Formats

### `selection.csv`

```text
food_id,source_id,external_id,category,preparation_state,notes,reviewer,reviewed_at
usda-foundation:748967,usda-foundation,748967,Dairy and Egg Products,,staple whole egg,nicholas,2026-10-03
```

- `food_id` is required and must match `<source>:<external-id>`.
- `preparation_state` is optional documentation (`raw` / `cooked` / …); runtime
  detection still reads the food description so raw/cooked words are retained.

### `aliases-overrides.csv`

```text
food_id,alias,locale,alias_type,rank_boost,reason,reviewer,reviewed_at
usda-sr-legacy:173944,banana,en,reviewed,1.0,common singular,nicholas,2026-10-03
```

Rules (enforced in `lib/selection.mjs`):

- `alias_type` ∈ `reviewed` | `generated` | `regional` (source aliases come from normalize).
- Never alias a **raw** food to a **cooked** term (or the reverse).
- Never alias salt ↔ sodium nutrient synonyms as food names.

### `category-quotas.json`

Fixture quotas are intentionally small so CI/demo stay offline. The `full` block
documents the 2k–5k production targets and the `selection.full.csv` path.

### `raw-cooked-pairs.csv`

```text
raw_food_id,cooked_food_id,staple,notes
usda-sr-legacy:171077,usda-sr-legacy:171079,chicken breast,raw vs roasted meat only
```

If both IDs appear in the active selection file, both must remain after filtering.

## Modes

| Mode | Selection file | Quotas |
| --- | --- | --- |
| fixture (default) | `selection.csv` | `category-quotas.json` → `fixture` |
| `USE_FULL_USDA=1` | `selection.full.csv` (required) | `category-quotas.json` → `full` |

### Full USDA path (not required for CI)

```bash
cd software
# 1) Download + normalize pinned archives
USE_FULL_USDA=1 node modules/food-catalog/scripts/build-seed/build-seed.mjs --out modules/food-catalog/scripts/build-seed/out/full-preview
# 2) Review candidates (normalized-foods.json), write selection.full.csv
# 3) Re-run; selection report must meet full quotas or emit an explicit deficit report
USE_FULL_USDA=1 node modules/food-catalog/scripts/build-seed/build-seed.mjs --out modules/food-catalog/scripts/build-seed/out/full-selected
```

Copy the header from `selection.csv` when authoring `selection.full.csv`. Large
reviewed lists may live outside git; keep a SHA-256 note in the PR when swapping.

## Artifacts written to `--out`

- `selection-report.json` — quota math, deficits, raw/cooked pair checks, alias counts
- `selected-food-ids.json` — ordered selected IDs
- Existing M1-06 emit outputs (`FoodSeed.sqlite`, manifest) still run so the pipeline
  stays end-to-end; **compression / signing / golden-query packaging is M1-08**.

## Demo

```bash
bash docs/demo/smoke-m1-07-selection.sh
```
