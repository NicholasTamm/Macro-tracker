# food-catalog

Expo/TypeScript contract for the replaceable read-only food seed and the food/diary-owned portion of the M1 user store. Profile, goal, target, and coaching models remain separate #13 work.

## Docs

- Full contract: [`docs/issue-12-food-schema-seed-contract.md`](../../../docs/issue-12-food-schema-seed-contract.md)
- Issue: [NicholasTamm/Macro-tracker #12](https://github.com/NicholasTamm/Macro-tracker/issues/12)

## Schema files

| File | Role |
| --- | --- |
| `schema/food-seed-v1.sql` | Canonical `FoodSeed.sqlite` DDL (USDA catalog + FTS5) |
| `schema/user-store-v1.sql` | Mutable `UserData.sqlite` + remote cache DDL (expo-sqlite) |

## Types

- `types.ts` — `FoodCandidate`, `PersistencePolicy`, `SeedManifest`, food references
- `nutrients.ts` — required / preferred / optional nutrient IDs

## Demo (smoke)

```bash
cd software/modules/food-catalog
bash demo/smoke.sh
```

SwiftData / CloudKit language in research OUT docs is **superseded**. M1 is local expo-sqlite only; AsyncStorage is for non-sensitive prefs only.

## Seed build (M1-06)

Pinned USDA Foundation + SR Legacy download → checksum → normalize → `FoodSeed.sqlite` pipeline:

```bash
cd software
npm run build-seed
# or: node modules/food-catalog/scripts/build-seed/build-seed.mjs
```

Default mode uses the golden fixture under `scripts/build-seed/fixture/` (no network).
Set `USE_FULL_USDA=1` to fetch the pinned archives listed in `scripts/build-seed/pinned-sources.json` (SHA-256 verified).

Smoke: `bash docs/demo/smoke-m1-06-seed-build.sh`

## Seed selection (M1-07)

Reviewed selection, alias overrides, and category quotas live under
`scripts/build-seed/selection/` (file-based — not emit hard-coding). The default
build applies `selection/selection.csv` after normalize and writes
`selection-report.json` + `selected-food-ids.json`.

```bash
cd software
node modules/food-catalog/scripts/build-seed/build-seed.mjs
```

Full USDA path: author `selection/selection.full.csv` (see `selection.full.csv.example`
and `selection/README.md`), then:

```bash
USE_FULL_USDA=1 node modules/food-catalog/scripts/build-seed/build-seed.mjs
```

Smoke: `bash docs/demo/smoke-m1-07-selection.sh`

## Seed emit packaging (M1-08)

After selection, the pipeline validates the SQLite catalog (integrity, FK,
default-serving ownership, required macros, FTS parity, golden queries),
compresses `FoodSeed.sqlite` (zstd, gzip fallback), and writes a signed
`seed-manifest.json` (Ed25519 over the compressed artifact SHA-256).

Dev signing keypair: `scripts/build-seed/keys/` (`food-seed-2026-01`).
Artifacts land under `scripts/build-seed/out/` (gitignored — no huge binaries in git).

```bash
cd software
node modules/food-catalog/scripts/build-seed/build-seed.mjs
# outputs: FoodSeed.sqlite, FoodSeed.sqlite.zst, seed-manifest.json, build-manifest.json
```

Smoke: `bash docs/demo/smoke-m1-08-foodseed-emit.sh`

Does **not** implement `LocalFoodRepository` runtime open (M1-09).
