# Search wiring (M1-12)

Offline Search UI helpers over `LocalFoodRepository`:

- **Debounce / cancel** — `createDebouncedRunner`, `createSearchController`
- **Result detail** — source label + per-100 g macros (`formatResultDetail`, `enrichSearchHits`)
- **a11y summary** — `formatSearchA11ySummary` for `accessibilityLiveRegion`
- **Browse sections** — Recent / Favorites / My Foods (`buildBrowseSections`; list reads from user-data)

Does **not** implement food detail / log sheet (M1-13) or remote packaged search (M2).
