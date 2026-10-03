# Rollout status — Milestone 1 (React Native / Expo)

**Stack:** Expo Router + React Native (`software/`), **not** Swift/SwiftUI.  
**Visual source of truth:** `/workspace/macrofactor-codex-research/design-system/` (`index.html`, `styles.css`, `scripts.js`).  
**Repo:** `NicholasTamm/Macro-tracker` · branch `feat/m1-design-system-scaffold`  
**Updated:** 2026-09-29 PT

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
| M1-05 | User models + persistence (SQLite/AsyncStorage plan) | todo (issue #12 defines the food/diary storage boundary; implementation has not started) |
| M1-06 | USDA seed build script | done |
| M1-07 | Selection/alias files + category quotas | done |
| M1-08 | FoodSeed sqlite + FTS | done |
| M1-09 | LocalFoodRepository search | done |
| M1-10 | Onboarding + profile | **done** (issue #44) |
| M1-11 | Today / journal with macros + meal slots | **done** (issue #49) |
| M1-12 | Search Recent/Favorites/My Foods | **done** (issue #50) |
| M1-13 | Food detail/log sheet | todo |
| M1-14 | Edit/delete/undo + snapshots | todo |
| M1-15 | Custom food CRUD | todo |
| M1-16 | Favorites/recents/quick-add | todo |
| M1-17 | Weight samples + chart | todo |
| M1-18 | Settings / About / data sources | todo |
| M1-19 | CSV/JSON export | todo |
| M1-20 | Seed updater (feature-flagged) | todo |
| M1-21 | A11y / localization / privacy QA | todo (checklist in #24 docs; device QA outstanding) |
| M1-22 | Educational insight cards | todo |

## Paths added this pass

- `software/design-system/tokens/` — Color, Spacing, Radius, Typography
- `software/design-system/theme/` — ThemeProvider + useTheme
- `software/design-system/components/` — listed M1-04 starters
- `software/design-system/Gallery.tsx` — ComponentGallery
- `software/app/(tabs)/component-gallery.tsx` — route
- `software/modules/*` — feature shells

## Issue #12 contract

Food schema / seed contract (Expo-reconciled): [`docs/issue-12-food-schema-seed-contract.md`](../docs/issue-12-food-schema-seed-contract.md) · module [`modules/food-catalog/`](./modules/food-catalog/) · demo `modules/food-catalog/demo/smoke.sh`.

## Issue #13 — MVP backlog (Expo)

Full Expo-reconciled Milestones 1–3 contract: [`docs/issue-13-mvp-backlog.md`](../docs/issue-13-mvp-backlog.md).  
Demo smoke: `bash docs/demo/smoke-mvp-backlog.sh` → `out/issue-13-smoke-result.txt`.

| Milestone | Exit (short) | Task IDs | Notes |
| --- | --- | --- | --- |
| M1 offline diary | Onboarding → USDA search → log/edit → custom food → weight → export (offline, no account) | M1-01…M1-22 | P0 blocks usable outcome; see backlog for Expo wording |
| M2 packaged + sync | OFF/FDC barcode, recipes, cross-platform sync (not CloudKit-default), health import | M2-01…M2-19 | Scanner/OCR/health behind platform-neutral adapters |
| M3 coaching + premium | TransparentTrend v1 opt-in check-in; IAP; free diary/export ungated | M3-01…M3-19 | Pure TS estimator; clinical/legal external gates |

M2/M3 detailed rows live only in the backlog doc until those milestones start; M1 rows above remain the live checklist.

## Issue #14 freemium matrix

Expo-reconciled free vs premium capability matrix (IAP / StoreKit+Play deferred to M3): [`docs/issue-14-freemium-matrix.md`](../docs/issue-14-freemium-matrix.md) · smoke `bash docs/demo/smoke-freemium-matrix.sh`. Free diary/export/deletion never gated; paywall module shell: `modules/paywall/`.

## Issue #15 primary-source verification log

Expo-reconciled primary-source verification log (USDA/OFF/FatSecret/licenses + adaptive-math bases; competitor App Store prices are context only): [`docs/issue-15-source-verification-log.md`](../docs/issue-15-source-verification-log.md) · smoke `bash docs/demo/smoke-source-log.sh`. Cross-platform SKU verification (App Store + Play) remains open before M3 paywall copy.

## Issue #19 sync architecture ADR

Cross-platform sync architecture and conflict policy (M1 local-only; CloudKit rejected as SoR; M2+ offline-first SQLite ↔ Postgres candidate): [`docs/issue-19-sync-architecture.md`](../docs/issue-19-sync-architecture.md) · smoke `bash docs/demo/smoke-sync-arch.sh`. Implementation remains M2-11/M2-12 in the MVP backlog.

## Issue #22 privacy / security architecture

Expo-reconciled data-flow and threat-model outline (nutrition/weight/health/provider/AI; expo-secure-store; no secrets in AsyncStorage): [`docs/issue-22-privacy-security.md`](../docs/issue-22-privacy-security.md) · smoke `bash docs/demo/smoke-privacy-security.sh`. Review required before network/health/sync/AI betas; counsel sign-off still outstanding.

## Issue #23 billing / store operations

Cross-platform StoreKit + Play Billing entitlement contract (one logical premium; localized prices; M3 purchase/restore matrix): [`docs/issue-23-billing-store-ops.md`](../docs/issue-23-billing-store-ops.md) · smoke `bash docs/demo/smoke-billing-store.sh`. IAP deferred to M3; no live price strings as policy.

## Issue #24 accessibility / localization audit

Expo-reconciled VoiceOver/TalkBack, Dynamic Type, Reduce Motion, themes, locales/RTL checklist before external beta: [`docs/issue-24-accessibility-localization.md`](../docs/issue-24-accessibility-localization.md) · smoke `bash docs/demo/smoke-a11y-l10n.sh`. Execution/remediation remains M1-21 (+ M2-19 / M3-19); criticals block external beta.

## Blockers

- Full Expo runtime / simulator not verified on this Linux box; TypeScript sources are authored for Expo 53 / RN 0.79.
- Parent owns commit/push to `feat/m1-design-system-scaffold`.
- OUT-doc GitHub issue comments (#11→#15) deferred to parent/ChatGPT review loop unless requested again.
