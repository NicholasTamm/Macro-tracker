# Rollout status — Milestone 1 (React Native / Expo)

**Stack:** Expo Router + React Native (`software/`), **not** Swift/SwiftUI.  
**Visual source of truth:** `/workspace/macrofactor-codex-research/design-system/` (`index.html`, `styles.css`, `scripts.js`).  
**Repo:** `NicholasTamm/Macro-tracker` · branch `feat/m1-design-system-scaffold`  
**Updated:** 2026-09-27 PT

## Design-system HTML reference

| Path | Role |
| --- | --- |
| `macrofactor-codex-research/design-system/styles.css` | `--app-*`, nutrient roles, spacing, radii, type |
| `macrofactor-codex-research/design-system/index.html` | Interactive component specimens |
| `software/design-system/` | RN port of tokens + starter components |

## Dual-stack note

`software/` is the product Expo app. No native Swift scaffold is in use (an abandoned SPM attempt was deleted uncommitted). Do not introduce Swift as the product direction.

## M1 task status (backlog order)

| ID | Task (RN reinterpretation) | Status |
| --- | --- | --- |
| M1-01 | Module scaffold: `design-system`, `modules/{app-core,diary,food-catalog,coaching,health-sync,paywall}`, AppShell via expo-router | **done** |
| M1-02 | CI: lint / typecheck workflow for Expo | **in_progress** (workflow added; green run pending push) |
| M1-03 | Typed tokens from HTML library (colors, spacing, radius, typography; light/dark) | **done** |
| M1-04 | Starter components + gallery: PrimaryButton, Card/RaisedTile, MacroSummary, FoodRow, ErrorBanner, OfflinePill, Empty/Loading, ComponentGallery | **in_progress** (specimens in; AX5/VoiceOver polish remaining) |
| M1-05 | User models + persistence (SQLite/AsyncStorage plan) | todo |
| M1-06 | USDA seed build script | todo |
| M1-07 | Selection/alias files | todo |
| M1-08 | FoodSeed sqlite + FTS | todo |
| M1-09 | LocalFoodRepository search | todo |
| M1-10 | Onboarding + profile | todo |
| M1-11 | Today / journal with macros + meal slots | todo |
| M1-12 | Search Recent/Favorites/My Foods | todo |
| M1-13 | Food detail/log sheet | todo |
| M1-14 | Edit/delete/undo + snapshots | todo |
| M1-15 | Custom food CRUD | todo |
| M1-16 | Favorites/recents/quick-add | todo |
| M1-17 | Weight samples + chart | todo |
| M1-18 | Settings / About / data sources | todo |
| M1-19 | CSV/JSON export | todo |
| M1-20 | Seed updater (feature-flagged) | todo |
| M1-21 | A11y / localization / privacy QA | todo |
| M1-22 | Educational insight cards | todo |

## Paths added this pass

- `software/design-system/tokens/` — Color, Spacing, Radius, Typography
- `software/design-system/theme/` — ThemeProvider + useTheme
- `software/design-system/components/` — listed M1-04 starters
- `software/design-system/Gallery.tsx` — ComponentGallery
- `software/app/(tabs)/component-gallery.tsx` — route
- `software/modules/*` — feature shells

## Blockers

- Full Expo runtime / simulator not verified on this Linux box; TypeScript sources are authored for Expo 53 / RN 0.79.
- Parent owns commit/push to `feat/m1-design-system-scaffold`.
- OUT-doc GitHub issue comments (#11→#15) deferred to parent/ChatGPT review loop unless requested again.
