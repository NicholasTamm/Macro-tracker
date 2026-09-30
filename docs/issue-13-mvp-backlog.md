# Issue #13 — MVP backlog Milestones 1–3 (Expo reconciliation)

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-mvp-backlog.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/`.  
**Source issue:** [NicholasTamm/Macro-tracker #13](https://github.com/NicholasTamm/Macro-tracker/issues/13)  
**Research OUT (Swift-era, superseded for implementation):** `/workspace/macrofactor-codex-research/OUT/mvp-backlog.md`

## Supersession notice

SwiftUI / Xcode / SwiftData / CloudKit / StoreKit / VisionKit / HealthKit / Swift Charts prescriptions in the research OUT doc and the original GitHub issue #13 body are **superseded** for Macro-tracker implementation. Product scope, P0 rules, milestone exits, food-source order, freemium stance, and safety gates remain binding.

| Research prescription | Expo / RN decision |
| --- | --- |
| Native SwiftUI iOS 17+ app | Expo Router app under `software/` (iOS + Android) |
| Xcode workspace + SPM/module targets | TypeScript modules under `software/modules/{app-core,diary,food-catalog,coaching,health-sync,paywall}` + `software/design-system/` |
| SwiftFormat / SwiftLint | ESLint + `tsc --noEmit` (+ secret scan in CI) |
| SwiftData user models | Mutable `UserData.sqlite` via **expo-sqlite** (see [#12 contract](./issue-12-food-schema-seed-contract.md)) |
| Private CloudKit as sync default | **No sync in M1.** Later sync must be cross-platform; CloudKit is not the default system of record |
| VisionKit / AVFoundation barcode | Platform-neutral scanner interface + Expo-compatible adapters (`expo-camera` / vision-camera) in a **dev client** |
| On-device Vision OCR | Platform-neutral OCR interface; on-device ML Kit / Vision adapters — never auto-save / auto-log |
| HealthKit | Health interface + iOS HealthKit / Android Health Connect adapters; coaching never consumes wearable EE |
| Swift Charts | Accessible chart library (e.g. Victory Native / Skia) with textual summaries |
| StoreKit 2 | Cross-platform IAP (StoreKit + Play Billing) behind entitlement service; free diary/export never gated |
| Pure-Swift EWMA / TDEE | Pure **TypeScript** `TransparentTrend v1` estimator with deterministic fixtures |
| watchOS / App Intents / widgets | Optional post-M3 surfaces behind feature flags; not M1 blockers |
| Share sheet export | Expo Sharing / platform share sheet |

**Pointers**

- Design system (RN): [`software/design-system/`](../software/design-system/) · HTML reference: research `design-system/` (tokens/layout only — no MacroFactor trademarks/assets)
- Food schema / seed contract (#12): [`docs/issue-12-food-schema-seed-contract.md`](./issue-12-food-schema-seed-contract.md) · [`software/modules/food-catalog/`](../software/modules/food-catalog/)
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)
- Investigation (#11): merged Expo reconciliation on `main` / issue #11 header

**Hard exclusions (unchanged):** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering.

---

## Delivery rules (P0 / P1 / P2)

- **`P0`** blocks the milestone’s usable outcome; **`P1`** is expected before milestone exit; **`P2`** may roll forward.
- Every task includes unit/integration tests proportional to risk. UI work includes screen-reader labels, Dynamic Type / font scaling, light/dark, empty/error/offline states, and 44×44 touch targets (AX5 where applicable).
- Food catalog (`FoodSeed.sqlite`) and user store (`UserData.sqlite`) remain separate. Remote vendor payloads never enter the durable shared seed unless license expressly permits.
- Use public source URLs in About/Data Sources and preserve them in build metadata.
- Estimate scale: `S` ≤1 focused engineer-day, `M` 2–4 days, `L` 5–10 days including tests/review. Estimates exclude store review, legal/clinical turnaround, and unknown vendor onboarding.

---

## Milestone mapping

Task IDs (`M1-01` … `M3-19`) stay stable so `ROLLOUT-STATUS.md` and issue boards can track the same rows. Wording below is the Expo-reconciled task text.

## Milestone 1 — offline diary foundation

**Exit outcome:** A new user can install offline, complete lightweight onboarding, find a USDA staple, log/edit/delete it in a fixed meal slot, create a custom food, see daily totals, log weight, view a basic chart, and export all user-owned data. No account, subscription, or network is required.

| ID | Pri | Task (Expo) | Est | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| M1-01 | P0 | Module scaffold: Expo Router AppShell + `design-system` + `modules/{app-core,diary,food-catalog,coaching,health-sync,paywall}` with no circular imports | M | — | App typechecks/lints on CI; modules export clean shells. |
| M1-02 | P0 | CI: install, `tsc`, ESLint, unit tests, secret scan, artifact retention | M | M1-01 | Clean clone passes; CI fails on tests/lint/committed secret fixture. |
| M1-03 | P0 | Typed semantic color, spacing, radius, type tokens from design-system HTML → RN | M | M1-01 | Token tests; light/dark gallery; no raw feature hex literals. |
| M1-04 | P1 | Reusable `PrimaryButton`, `Card`, `MacroSummary`, `FoodRow`, `ErrorBanner`, `OfflinePill`, empty/loading + ComponentGallery | L | M1-03 | Gallery passes AX5 layout, 44×44 targets, screen-reader labels. |
| M1-05 | P0 | Define expo-sqlite v1 user models (stable UUIDs, tombstones, migration tests); honor missing≠zero nutrients | L | M1-01, #12 | CRUD/migration/relaunch tests; schema matches #12 user-store DDL. |
| M1-06 | P0 | USDA seed build script: pinned download, checksum, schema parser, Foundation/SR filter, normalization | L | — | Reproducible from clean env; source URL/release/hash recorded; no API crawl. |
| M1-07 | P0 | Reviewed 2k–5k selection/alias files and category quotas | L | M1-06 | Quotas met; raw/cooked distinctions survive; overrides reviewable. |
| M1-08 | P0 | Emit `FoodSeed.sqlite` v1, FTS5, validations, compression, signed manifest | L | M1-06, M1-07 | Schema matches #12 `food-seed-v1.sql`; integrity/FK/golden-query tests; real SHA-256. |
| M1-09 | P0 | Bundle/open read-only seed via expo-sqlite; `LocalFoodRepository` exact/FTS/fuzzy-top-50 | L | M1-05, M1-08 | Warm common query p95 budget on lowest supported device; ranking fixtures pass. |
| M1-10 | P0 | Lightweight onboarding + local profile/goal persistence | L | M1-03, M1-05 | Adult gate, units, biometrics, goal/rate, starter target; state survives back/relaunch; exclusions disable coaching shell. |
| M1-11 | P0 | Today: date selector, calorie/P/C/F, four default meal slots, offline-first entries | L | M1-04, M1-05 | Empty/populated day offline; timestamps independent of slot IDs. |
| M1-12 | P0 | Search: Recent/Favorites/My Foods + local FTS | L | M1-04, M1-09 | Cancel/debounce correct; source/per-100 g visible; a11y result summary. |
| M1-13 | P0 | Food detail/log sheet: grams, source servings, decimal qty, meal/time, live nutrient math | L | M1-11, M1-12 | Golden calc tests; invalid/negative blocked; Today updates atomically. |
| M1-14 | P0 | Diary edit/delete/undo + immutable nutrition snapshots | M | M1-13 | Qty edit recalculates from snapshot; undo works; seed update cannot rewrite history. |
| M1-15 | P0 | Custom-food create/edit/archive with macros + optional full nutrients/barcode | L | M1-05, M1-12 | Missing vs zero; barcode validation; old snapshots unchanged after edit. |
| M1-16 | P1 | Favorites, recents, last quantity/unit, quick-add | M | M1-12, M1-13 | Transaction-safe updates; ordering fixtures. |
| M1-17 | P1 | Weight sample CRUD + 30-day accessible chart (RN chart lib + textual summary) | M | M1-04, M1-05 | kg/lb round-trip within tolerance; sparse/empty states. |
| M1-18 | P0 | Settings: units/theme, profile, About/Data Sources, licenses, privacy placeholder | M | M1-03, M1-05, M1-08 | USDA citation shown; units change display only. |
| M1-19 | P0 | Complete CSV + JSON export via platform share sheet | M | M1-05, M1-14 | Offline export includes profile, diary snapshots, weights, targets, provenance; round-trip fixture. |
| M1-20 | P1 | Seed update client with signed-manifest verify + atomic rollback; feature-flagged until CDN | L | M1-08, M1-09 | Corrupt signature/hash/schema/low-space keep prior catalog. |
| M1-21 | P0 | Accessibility / localization / privacy QA | L | M1-10–M1-19 | Screen reader, Reduce Motion, contrast, RTL smoke, camera-free privacy review; zero critical issues. |
| M1-22 | P2 | Basic educational insight cards (local content) | S | M1-11 | Generic, dismissible, no unreviewed health claims. |

### Milestone 1 non-goals

Barcode scanning, any remote food provider, recipes, account/sync, HealthKit/Health Connect, adaptive expenditure, weekly check-ins, subscription, AI, widgets, and Watch/Wear.

## Milestone 2 — packaged foods, recipes, and sync

**Exit outcome:** Barcode and explicit online packaged-food lookup use OFF first and FDC Branded second; the app remains fully usable offline for local/custom/history. Users can build recipes, optionally sync user data with a **cross-platform** sync service, and import weight from health platforms.

| ID | Pri | Task (Expo) | Est | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| M2-01 | P0 | `FoodProvider` TS interface, unified DTO, provenance, persistence policy, typed errors | M | M1-09 | Contract tests: durable / expiry / identifiers-only / no-shared-cache. |
| M2-02 | P0 | GTIN normalization/check digits + 2s duplicate-scan suppression | M | M2-01 | UPC-A/EAN-8/EAN-13 fixtures; bad checks → manual fallback. |
| M2-03 | P0 | Barcode scanner behind platform-neutral API + Expo-compatible adapters; permission/unsupported states | L | M2-02, M1-04 | Works on supported device; sim/denied/unsupported testable; no scan-loop storms. |
| M2-04 | P0 | OFF v3 product-read adapter: User-Agent, rate limit, retries, quality flags, attribution | L | M2-01 | Staging for integration tests; 429/503/offline/miss handled; no new v2. |
| M2-05 | P0 | FDC Branded fallback + exact normalized-GTIN verification | M | M2-01, M2-02 | Key not committed; false name-only rejected; 429/backoff tested. |
| M2-06 | P0 | Barcode orchestration: custom/cache → OFF → FDC → OCR/manual | M | M2-03–M2-05 | Traceable provider path; miss → editable custom draft; offline queues one retry. |
| M2-07 | P1 | Explicit “Search packaged foods online”; never OFF search-as-you-type | M | M2-04, M1-12 | Local search instant; remote requires action; 10/min/IP guard. |
| M2-08 | P0 | Remote cache with provider TTL/purge; **not** synced by default | M | M2-01 | Expired purged; IDs retained only where allowed; provenance shown. |
| M2-09 | P0 | On-device nutrition-label OCR → editable custom-food draft | L | M1-15, M2-03 | On-device processing; confidence warnings; no auto-save/auto-log. |
| M2-10 | P1 | Recipe builder, ingredient snapshots, serving yield, explode/edit, ≤5 active free recipes | L | M1-13–M1-16 | Totals/per-serving fixtures; ingredient edits do not mutate historical diary. |
| M2-11 | P0 | Cross-platform sync configuration for **user store only** (catalog/cache excluded) | L | M1-05 | Schema + promotion checklist; CloudKit not required / not default SoR. |
| M2-12 | P0 | Sync conflict policy, tombstones, duplicate repair, account/sync-off states | L | M2-11 | Two-device edit/delete suite; no duplicate diary after replay. |
| M2-13 | P1 | Health platform granular auth + body-mass anchored import (HK / Health Connect adapters) | L | M1-17 | Denied/partial/revoked; source metadata + dedupe; no wearable EE into coaching. |
| M2-14 | P1 | Optional dietary energy/macros read/write behind feature flag | L | M2-13, M1-14 | Loop prevention/source priority; precise disclosure; off until product review. |
| M2-15 | P1 | Data-source attribution UI for OFF/FDC remote results | M | M2-04, M2-05, M2-08 | Notices in detail + About; export carries source tag, not shared catalog dump. |
| M2-16 | P0 | Network/privacy/security review + observability | L | M2-04–M2-14 | No payload/health in logs; pinning decision documented; metrics omit user content. |
| M2-17 | P0 | ODbL legal review of cache/export/merge | External | M2-04, M2-08, M2-15 | Written approval/remediation before external beta. |
| M2-18 | P2 | CDN seed updater production rollout with staged % / kill switch | M | M1-20, backend/CDN | Rollback drill; signing key rotation documented. |
| M2-19 | P0 | E2E offline/network/a11y regression | L | M2-01–M2-16 | Airplane-mode diary works; provider outage graceful; no critical a11y/privacy defects. |

### Milestone 2 non-goals

FatSecret activation, cloud photo AI, adaptive target changes, paywall enforcement, Watch/Wear app, and full widget suite.

## Milestone 3 — adaptive coaching and sustainable premium

**Exit outcome:** Eligible adults can opt into the original `TransparentTrend v1` estimator, see confidence/coverage, and explicitly accept or decline weekly changes. IAP unlocks premium without compromising the free diary/export. Compute-heavy AI and ecosystem surfaces remain behind feature flags until privacy/cost readiness.

| ID | Pri | Task (Expo) | Est | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| M3-01 | P0 | Pure-TypeScript EWMA trend engine + deterministic test vectors | L | M1-17 | 7-day half-life, missing days, init, outliers, backdated edits. |
| M3-02 | P0 | 21-day intake/weight regression, coverage gates, raw TDEE, 14-day damping, hold reasons | L | M3-01, M1-14 | Deficit/surplus/stable synthetics; incomplete days excluded; no NaN/unstable extremes. |
| M3-03 | P0 | Persist versioned `TrendPoint`, `ExpenditurePoint`, `AlgorithmRun`; recomputation queue | L | M3-01, M3-02, M1-05 | Earliest-change backfill deterministic; cancel/relaunch safe; algorithm version recorded. |
| M3-04 | P0 | Goal/rate guardrails + weekly proposal calculator (≤150 kcal/day and ≤5% change caps) | M | M3-02 | Boundary/property tests; signs correct; low confidence → no adjustment. |
| M3-05 | P0 | Clinical safety + copy review for eligibility, floors, exclusions, warnings, manual override | External | M3-04 | Written sign-off before coaching beta. |
| M3-06 | P0 | Check-in UI: coverage, confidence, reason, old/new target, Accept/Keep | L | M3-03–M3-05 | Never auto-applies; audit record; a11y; decline leaves targets untouched. |
| M3-07 | P1 | Progress expenditure/weight/intake charts + accessible textual summaries | L | M3-03, M1-17 | Calibration/hold clear; no implied medical precision. |
| M3-08 | P1 | Explainable rule-based insight feed | L | M3-03, M3-06 | Every card records inputs/rule/copy version + actionable dismissal. |
| M3-09 | P0 | Configure IAP products (iOS + Play) + intro offer in sandbox | M | Store accounts | Monthly/annual localized; same entitlement; offer eligibility verified. |
| M3-10 | P0 | Entitlement service, transaction listener, restore/manage, billing retry/grace tests | L | M3-09 | Buy/cancel/refund/revoke/upgrade/offline matrix; free data never hidden. |
| M3-11 | P0 | Contextual paywalls + feature gates per freemium matrix | L | M3-10 | Continue Free clear; export/delete/manual diary never gated; a11y + Reduce Motion. |
| M3-12 | P1 | Basic free widget + premium widget/intent set via shared summary store | L | M3-10, M2-11 | Widget never reads main DB unsafely; stale/error privacy states. |
| M3-13 | P2 | Wearable logging/overview prototype (optional) | L | M3-12, M2-12 | Recent/favorite log path; connectivity conflict tests; no parity claim. |
| M3-14 | P1 | Cloud AI provider spike + privacy/cost bake-off; no production user traffic | L | Backend/security | Accuracy, latency, retention, processor terms, regional routing, cost documented. |
| M3-15 | P1 | Opt-in AI photo/Describe behind remote flag + allowance service | L | M3-10, M3-14 | EXIF stripped; consent before upload; failed not charged; editable result; deletion tested. |
| M3-16 | P2 | FatSecret adapter behind disabled server flag | L | Vendor + legal + proxy | Proxy-only OAuth; attribution; 24h purge; Basic never for barcode. |
| M3-17 | P0 | Privacy policy, store privacy answers, terms, nutrition/health disclaimers, deletion review | External + L | M2-16, M3-10, M3-15 | Counsel/privacy approval; deletion/export drills; subprocessors listed. |
| M3-18 | P0 | Storefront validation for US/CA prices/trial and screenshots | S | M3-09 | Fresh purchase-sheet evidence. |
| M3-19 | P0 | Beta readiness audit + release runbook | L | All M3 P0 | Legal/clinical/privacy/a11y/security blockers closed; rollback/kill switches + support FAQ. |

---

## Critical path

```text
M1-01 → M1-05 → M1-11 → M1-13 → M1-14
       ↘ M1-06 → M1-07 → M1-08 → M1-09 → M1-12 ↗

M1 exit → M2-01 → M2-04/M2-05 → M2-06 → M2-17 → M2 exit
        ↘ M2-11 → M2-12 ───────────────────────────↗

M2 exit → M3-01 → M3-02 → M3-04 → M3-05 → M3-06
        ↘ M3-09 → M3-10 → M3-11 ────────────────→ beta audit
```

---

## Cross-cutting test fixtures

- Food calculations: grams/servings, decimal rounding, missing nutrients, energy-unit conversions.
- Search: 50–100 golden queries with expected top groups, including raw/cooked disambiguation.
- Barcode: UPC-A/EAN-8/EAN-13/GTIN-14, bad check digits, OFF miss, FDC false-name match.
- Diary: timezone/DST boundaries, duplicate commit, edit/delete/undo, seed/custom changes after logging.
- Sync: two-device concurrent edits, delete/update race, offline replay, sync disabled/full.
- Coaching: stable/lose/gain synthetic series, incomplete days, sparse weights, water-noise spike, backfill, version migration.
- IAP: eligible/ineligible trial, pending, cancel, refund, revoke, billing retry, grace, offline cache, restore.
- Accessibility: screen-reader order/labels, AX5 layouts, Reduce Motion, contrast, Voice Control / TalkBack, RTL.

---

## Risks that are not engineering tasks

| Risk | Required resolution |
| --- | --- |
| App name/trademark | Product selects original candidates; counsel clears before public build. |
| OFF ODbL classification | Written legal analysis of cache, export, merge, and any future subset distribution. |
| Adaptive safety | Registered-dietitian/medical review; adult-only/exclusion and clinician-override policy. |
| Vendor access | FatSecret approval and exact accepted terms; Nutritionix dated quote if reconsidered. |
| AI data handling | Processor contract, privacy disclosures, retention/deletion, regional routing, incident response. |

---

## Demo

```bash
# from repo root (this branch)
bash docs/demo/smoke-mvp-backlog.sh
```

Validates that this document exists, contains Milestones 1–3 headings, preserves task ID rows `M1-01`…`M3-19`, and records Expo supersession keywords.
