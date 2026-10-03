# LocalFoodRepository — warm common-query budget (M1-09)

## Target

| Metric | Budget | Notes |
| --- | --- | --- |
| Warm common-query **p95** | **≤ 150 ms** | Lowest supported device (backlog M1-09 / OUT mvp-backlog) |
| Candidate pool | ≤ 50 | Fuzzy rerank never full-table scans |

“Warm” means the seed DB handle is already open (no cold asset copy / first-open cost).

## Common queries (fixture + production intent)

`banana`, `egg`, `chicken breast`, `brown rice`, `olive oil`, `broccoli`, `milk`

## Measurement

Node smoke (`docs/demo/smoke-m1-09-local-food-repo.sh`) times a warm loop of the ranking-fixture queries against the bundled fixture seed via `node-sqlite3-wasm` (FTS5). It records p95 into `out/issue-43-smoke-result.txt`.

Device validation (Expo / expo-sqlite) is deferred to a physical/lowest-supported device pass; the same 150 ms p95 target applies once the fixture or CDN seed is opened read-only.

## Implementation notes

- Exact match is a simple equality on `normalized_name` / `normalized_alias`.
- FTS uses `bm25(food_fts, 10, 5, 1)` (name > aliases > category) with prefix tokens.
- Fuzzy edit-distance rerank runs only on the top-50 retrieval pool.
