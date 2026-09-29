# Issue #12 — Food schema and seed contract (Expo reconciliation)

**Reconciled:** 2026-09-28 PT  
**Status:** Submitted as a GitHub PR for review (`docs/issue-12-food-schema`); not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `software/modules/food-catalog/demo/smoke.sh`.  
**Shipping stack:** Expo + React Native + TypeScript (`expo-sqlite` for catalog + user store).  
**Source issue:** [NicholasTamm/Macro-tracker #12](https://github.com/NicholasTamm/Macro-tracker/issues/12)  
**Research OUT (Swift-era, superseded for implementation):** `/workspace/macrofactor-codex-research/OUT/food-schema.md`

## Supersession notice

SwiftData, CloudKit, and Swift `FoodCandidate` prescriptions in the research OUT doc and GitHub issue #12 body are **superseded** for Macro-tracker M1:

| Research prescription | Expo / RN decision |
| --- | --- |
| SwiftData user store | Mutable `UserData.sqlite` via **expo-sqlite** (logical schema in `schema/user-store-v1.sql`) |
| Private CloudKit sync (M2) | **No sync in M1.** Later sync must be cross-platform; CloudKit is not the default system of record |
| Swift `FoodCandidate` DTO | TypeScript `FoodCandidate` in `software/modules/food-catalog/types.ts` |
| GRDB / thin native SQLite | `expo-sqlite` (or compatible Expo adapter) opens bundled read-only `FoodSeed.sqlite` |
| AsyncStorage for domain data | **Forbidden** for foods/diary. AsyncStorage only for small non-sensitive prefs |

Canonical in-repo copies: `software/modules/food-catalog/schema/*.sql`, `types.ts`, `nutrients.ts`.

## 1. Storage boundaries

| Store | Contents | Sync | Mutation model |
| --- | --- | --- | --- |
| `FoodSeed.sqlite` | Curated USDA Foundation + SR Legacy foods, nutrients, servings, aliases, FTS index, source metadata | CDN artifact replacement; never CloudKit | Immutable at runtime |
| `UserData.sqlite` (expo-sqlite) | Custom foods/recipes, diary entries + immutable nutrient snapshots, favorites/recents, weights, goals, later coaching outputs | Local only in M1 | User-owned CRUD |
| Remote cache (table in user DB or sibling file) | OFF and FDC Branded responses where allowed; provider IDs/expiry for restricted sources | Device-local; not CloudKit by default | TTL/provider policy |

Do not model a 2,000–5,000 row nutrient catalog as ORM objects in JS memory as the primary store. SQLite gives predictable FTS, compact delivery, and atomic seed replacement. Do not add OFF, FatSecret, Edamam, Spoonacular, or Nutritionix rows to `FoodSeed.sqlite` under the MVP plan.

## 2. Canonical identifiers and units

- `food_id`: deterministic string, `<source>:<external-id>`; examples `usda-foundation:1234567` and `usda-sr-legacy:171077`. Stable across seed builds.
- `nutrient_id`: internal canonical slug. Preserve upstream nutrient number in `source_nutrient_id`.
- Base mass: grams. Base liquid volume: millilitres only when source density/volume basis is known.
- Nutrients in the catalog are stored per 100 g. Never infer that 100 ml equals 100 g.
- Store energy as kcal; retain source kJ only as a separate nutrient/value or provenance field.
- `NULL` means unavailable. Numeric zero means the source explicitly reports/calculates zero. Never coerce missing to zero.
- GTIN is normalized to digits-only 14-character form for comparison; retain original for display/debug. Validate check digits.

## 3. SQLite catalog schema (v1)

Canonical DDL: [`software/modules/food-catalog/schema/food-seed-v1.sql`](../software/modules/food-catalog/schema/food-seed-v1.sql).

SQLite 3 with foreign keys enabled. Migrations create a **new seed artifact** rather than altering the bundled database in place. Tables: `catalog_metadata`, `source`, `food`, `nutrient_definition`, `food_nutrient`, `serving`, `alias`, `food_fts` (FTS5), `category_quota`, `build_validation`.

After inserting servings, set `food.default_serving_id` and verify same-food ownership in CI (SQLite cannot express that cross-row FK simply).

### Required v1 nutrients

Canonical list: [`software/modules/food-catalog/nutrients.ts`](../software/modules/food-catalog/nutrients.ts).

| Canonical ID | Unit | Required? |
| --- | --- | --- |
| `energy_kcal` | kcal | Yes; reject food otherwise |
| `protein` | g | Yes |
| `carbohydrate` | g | Yes |
| `fat_total` | g | Yes |
| `fiber` | g | Preferred; nullable |
| `sugars_total` | g | Preferred; nullable |
| `fat_saturated` | g | Preferred; nullable |
| `fat_monounsaturated` / `fat_polyunsaturated` / `fat_trans` | g | Optional |
| `cholesterol` / `sodium` / `potassium` / `calcium` / `iron` | mg | Preferred; nullable |
| Remaining micros (`magnesium` … `alcohol`) | varied | Optional |

Do not synthesize “net carbs.” If displayed, calculate only when required source fields are present and label the formula by locale.

## 4. Search document construction

One FTS row per food:

```text
name     = normalized primary description with preparation words retained
aliases  = space-joined reviewed/generated aliases
category = normalized category
```

Query stages: exact name/alias → FTS prefix + bm25 (name > aliases > category) → token intersection → optional fuzzy rerank of top 50 → rank adjustments. Alias rules must be deterministic and reviewed; maintain `aliases-overrides.csv` in source control when seed builds begin (not in this PR).

## 5. User-data schema (expo-sqlite, replaces SwiftData)

Logical models mapped to SQL in [`schema/user-store-v1.sql`](../software/modules/food-catalog/schema/user-store-v1.sql). All stable identifiers are application-generated UUID strings.

### CustomFood

`id`, `name`, `brand?`, `barcodeGTIN14?`, `basisKind` (mass|volume|serving), `basisAmount`, `basisUnit`, `gramWeightForBasis?`, `nutrients` (JSON; explicit missing vs present), `createdAt`, `updatedAt`, `isArchived`, `deletedAt?`, `syncRevision`.

### FoodReference

`kind`: seed | custom | off | fdc_branded | fatsecret; `stableId`; `providerId?`; `gtin14?`; `displayName`; `brand?`; `licenseTag`.

### DiaryEntry

`id`, `timestamp`, `localDayKey` (yyyy-MM-dd in recorded TZ), `timezoneIdentifier`, `mealSlotId?`, `foodReference`, `quantity`, `unitLabel`, `grams?`, `nutritionSnapshot` (immutable), source/license fields, `createdAt`/`updatedAt`/`deletedAt?`, `syncRevision`.

`NutritionSnapshot` keeps history stable if a USDA seed changes or a custom food is edited. Restricted vendors: persist snapshots only when the contract expressly permits; otherwise provider/serving ID + user-entered values, or disable the adapter.

### Other models

`DiaryDayStatus`, `MealSlot`, `Favorite`, `RecentFood`, `Recipe`, `WeightSample` — see SQL DDL. Use tombstones (`deletedAt`) for sync-safe deletion when sync arrives post-M1.

## 6. Remote DTO and cache schema

TypeScript `FoodCandidate` and `PersistencePolicy` replace the Swift structs — see `types.ts`.

Device-local cache table `remote_food_cache` lives in the user store DDL (or a sibling writable SQLite file). Provider policies unchanged in intent:

| Provider | Cache rule |
| --- | --- |
| USDA local / FDC Branded | Durable with citation |
| OFF | Durable only with ODbL attribution and legal-approved export/merge; images omitted in MVP |
| FatSecret | IDs indefinite; other fields ≤24h; never into shared seed |
| Edamam / Spoonacular / Nutritionix | Disabled by default pending contract |

## 7. Barcode normalization and lookup

Order: validate symbology/check digit → normalize to GTIN-14 → user custom + local cache → OFF v3 → USDA Branded exact GTIN → optional FatSecret backend → OCR custom-food draft. Deduplicate identical scans (~2s). Negative cache briefly; never block manual retry after contribution.

## 8. Seed selection and validation

Target 2,000–5,000 foods; Foundation first; SR Legacy for gaps; category quotas; CI gates as in issue #12 / OUT (checksums, required macros, FTS count, attribution, golden searches). **This PR does not build the multi-thousand-row seed** — only the contract + tiny demo fixture.

## 9. Seed manifest

JSON shape (TypeScript: `SeedManifest` in `types.ts`):

```json
{
  "manifestVersion": 1,
  "catalogSchemaVersion": 1,
  "seedVersion": "2026.09.23.1",
  "minimumAppBuild": 1,
  "createdAt": "2026-09-23T20:00:00Z",
  "artifact": {
    "url": "https://cdn.example.invalid/food-seed/v1/.../FoodSeed.sqlite.zst",
    "compression": "zstd",
    "compressedBytes": 0,
    "uncompressedBytes": 0,
    "sha256": "64-lowercase-hex-characters",
    "signature": "base64-ed25519-signature",
    "signingKeyID": "food-seed-2026-01"
  },
  "content": {
    "foodCount": 0,
    "servingCount": 0,
    "nutrientValueCount": 0,
    "ftsDocumentCount": 0,
    "locales": ["en"]
  },
  "sources": [],
  "releaseNotes": "placeholder"
}
```

Example hostname/sizes/hashes are placeholders. CI generates real values; humans do not edit published manifests.

## 10. App update protocol

1. Open bundled/current DB immediately; catalog update never blocks first use.
2. Check manifest at most weekly and after app updates (respect Low Data Mode / user settings).
3. Require HTTPS, embedded trusted signing public key, valid signature, matching SHA-256, compatible schema/build, free space, monotonic seed version.
4. Download to temp path; decompress; `quick_check`, FK check, metadata/version, golden queries.
5. Atomic rename current → previous, staged → current; delete previous only after new catalog survives a launch.
6. On failure, keep current + exponential backoff. Never delete the only working catalog.

## 11. Attribution UI contract

- Settings → About → Data Sources: USDA citation + release.
- OFF screens: “Open Food Facts” + product/source link; About shows ODbL/DbCL notices when applicable.
- FatSecret attribution wherever its content appears (if enabled), per its policy.
- Exports include per-entry source/license tags; must not silently export a substantial OFF-derived catalog.

## 12. Unverified items that block expansion

- OFF derivative-database classification (counsel before offline subset).
- FatSecret diary persistence (written confirmation for immutable snapshots).
- Nutritionix price/rights (dated contract).
- CNF API rate limit (prefer downloadable dataset; ask Health Canada before high-volume API).
- Density conversions (source-backed or reviewed only).

## Demo

```bash
cd software/modules/food-catalog
bash demo/smoke.sh
```

Creates a tiny in-memory-path `FoodSeed` from DDL + fixture, builds empty `UserData`, prints nutrient IDs / schema version from TypeScript, runs `tsc --noEmit`.

## Definition of done for this issue

1. Expo-reconciled contract markdown in `docs/`.
2. Canonical SQL + TypeScript types under `software/modules/food-catalog/`.
3. Runnable smoke demo.
4. No multi-thousand-row USDA download in this PR.
5. Human approval before merge; do not start issues #13–#15 from this work.
