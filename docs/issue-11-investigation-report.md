# Issue #11 investigation report — Expo reconciliation

**Reconciled:** 2026-09-27 PT  
**Status:** Submitted as a GitHub PR for review (`docs/issue-11-expo-reconciliation`); not merged. Awaiting Nicholas approval — do not merge without explicit approval.  
**Shipping stack:** Expo + React Native + TypeScript.  
**Target platforms:** iOS and Android first, with web kept viable where a capability exists.  
**Source issue:** [NicholasTamm/Macro-tracker #11](https://github.com/NicholasTamm/Macro-tracker/issues/11)  
**Visual source of truth:** `/workspace/macrofactor-codex-research/design-system/`

## Decision and precedence

Issue #11 remains the product-research record for competitive context, safety boundaries, food-provider policy, the offline-first milestone cut, and the original `TransparentTrend v1` proposal. Its Swift-specific implementation recommendations are superseded by this document.

The app in `/workspace/Macro-tracker/software` is the product. It is not a prototype that will later be replaced by SwiftUI. New product work must be implemented in React Native/Expo unless a narrowly scoped native platform extension is required and exposed through an Expo-compatible adapter.

This reconciliation does not authorize publication or alter the public issue. The eventual publication target is `NicholasTamm/Macro-tracker` on `feat/m1-design-system-scaffold`, subject to explicit human approval.

## Evidence and originality boundary

- Public product/help/store sources may establish capability categories and business context, but they are not implementation specifications.
- No MacroFactor trademarks, product copy, icons, screenshots, food art, photography, private APIs, database contents, or reverse-engineered behavior may enter the app.
- The HTML component library is a visual reference, not runtime code. Port its semantic roles, layout grammar, density, and interaction patterns into native React Native components.
- The research-only `MacroSans-VF.ttf` must not be shipped unless its license and redistribution rights are independently confirmed. The Expo app should use platform/system fonts until then.
- USDA, Open Food Facts, and any later provider retain separate provenance, attribution, storage, and cache-policy boundaries.

## Reconciled executive decisions

1. **The product is genuinely freemium.** Manual diary, local USDA search, custom foods, weight logging, basic progress, and complete CSV/JSON export remain free. Premium may add adaptive coaching, advanced insights, cloud convenience, and compute-heavy automation.
2. **Milestone 1 is local and offline-first.** No account, subscription, or network is required for onboarding, Today, local food search, serving edits, custom foods, diary edits, weigh-ins, basic progress, and export.
3. **Catalog and user data stay separate.** A replaceable read-only SQLite food catalog is distinct from a mutable user-owned SQLite database. Small non-sensitive UI preferences may use AsyncStorage; secrets belong in secure platform storage, never AsyncStorage or source control.
4. **The food lookup order remains fixed.** User library/cache → local USDA full-text search → Open Food Facts barcode → USDA Branded fallback → optional approved provider proxy → manual/OCR.
5. **The estimator remains original and explainable.** `TransparentTrend v1` may be implemented later from the public mathematics and safety gates in issue #11. It must never be described as compatible with, equivalent to, or derived from MacroFactor’s private algorithm.
6. **The shipping client is Expo/React Native.** Expo Router owns navigation; TypeScript modules own domain contracts; platform-specific capabilities sit behind adapters usable from Expo development builds.
7. **Human review remains a release gate.** Food-data licensing, privacy/security, nutrition guardrails, billing copy, accessibility, and trademark/name clearance require their respective reviewers before an external beta.

## Stack reconciliation matrix

| Swift-era prescription in issue #11 | Expo / React Native decision |
| --- | --- |
| SwiftUI app and Xcode workspace | Expo Router app in `software/`; TypeScript is the product source. Native projects are generated or added only for a justified platform integration. |
| Swift package/target boundaries | TypeScript feature modules in `software/modules/` with dependency direction enforced by public interfaces and lint/typecheck rules. |
| SwiftData user store | Separate mutable `UserData.sqlite`, accessed through repository interfaces and migrations. AsyncStorage is limited to small preferences/drafts. |
| GRDB/thin native SQLite catalog | `expo-sqlite` (or a compatible Expo adapter) opens the bundled, immutable `FoodSeed.sqlite` and executes FTS5 queries. |
| SwiftData + private CloudKit sync | No sync in M1. A later cross-platform sync service must preserve stable IDs, tombstones, conflict policy, export, and deletion across iOS and Android. CloudKit is not the default system of record. |
| VisionKit / AVFoundation barcode scanner | Expo Camera barcode support behind a `BarcodeScanning` interface; use a development build when Expo Go cannot host the required native capability. |
| Vision OCR | On-device OCR behind a platform-neutral interface, implemented through vetted iOS Vision and Android ML Kit adapters in an Expo development build. Every parse remains an editable draft. |
| HealthKit-only integration | `HealthSyncing` interface with Apple HealthKit and Android Health Connect adapters. M1 ships the interface/shell only. |
| Swift Charts | Accessible React Native charts using an Expo-compatible renderer. Every visual chart also exposes a text summary and respects reduced motion and large text. |
| StoreKit 2 / `SubscriptionStoreView` | `EntitlementProviding` and `BillingClient` interfaces backed by Apple StoreKit and Google Play Billing through an Expo-compatible purchase library or service. Storefront-localized price and eligibility remain authoritative. |
| WidgetKit, App Intents, watchOS | Post-MVP native extension work behind shared TypeScript data contracts/config plugins. It must not reshape the M1 app architecture. |
| `ShareLink` export | Expo file-system/share adapters on native and standards-based download/share on web. Export remains complete and free. |
| SF Symbols as the icon system | Cross-platform icons already available to Expo, with accessible labels and consistent geometry. Platform symbols may be used only through a fallback-safe abstraction. |

## Expo module boundaries

```text
software/
├── app/                  Expo Router routes and composition only
├── design-system/        semantic tokens, theme, accessible primitives, gallery
├── modules/
│   ├── app-core/         providers, navigation contracts, feature flags, policy
│   ├── diary/            days, entries, meal slots, totals, copy/edit/delete
│   ├── food-catalog/     seed SQLite, FTS, provider adapters, provenance
│   ├── coaching/         goals, trend/expenditure engine, check-ins, insights
│   ├── health-sync/      platform-neutral health contracts and adapters
│   └── paywall/          entitlements, billing products, restore state
└── assets/               original or properly licensed application assets only
```

Domain modules must not import route files. `food-catalog` must not import UI or paywall code. Coaching consumes diary and weight summaries rather than screen state. Platform integrations implement small interfaces such as `FoodSearching`, `DiaryStore`, `CoachingEngine`, `HealthSyncing`, and `EntitlementProviding`.

## Persistence architecture

### Food catalog

`FoodSeed.sqlite` is a versioned, replaceable, read-only artifact containing curated USDA Foundation and SR Legacy foods, nutrient values normalized per 100 g, household servings, reviewed aliases, source metadata, and an FTS5 index.

- The app ships a known-good seed for immediate offline use.
- Remote catalog updates are feature-flagged and no more frequent than weekly.
- Replacement requires manifest/schema checks, checksum/signature verification, free-space validation, a smoke query, and atomic rollback.
- Open Food Facts and contract-restricted vendor data never enter this seed.

### User-owned data

`UserData.sqlite` stores profile, goals, custom foods, diary entries, immutable nutrient snapshots, favorites, recents, weights, and later coaching outputs.

Every mutable record uses a stable UUID plus `createdAt`, `updatedAt`, and nullable `deletedAt`. Nutrient fields preserve `null` (unavailable) separately from numeric zero. Diary entries store both an independent timestamp and an optional fixed meal-slot ID. Schema migrations are ordered, transactional, and covered by relaunch/migration tests.

AsyncStorage may store only small, non-sensitive presentation preferences and recoverable onboarding drafts. Authentication tokens, vendor secrets, and health credentials must not be stored there. Production provider secrets remain off-device behind a rate-limited backend.

## Capability map

| Capability | Expo / React Native implementation direction | Milestone |
| --- | --- | --- |
| Navigation | Expo Router with typed routes and route-level composition | M1 |
| Theme/components | React Native primitives driven by `design-system/` semantic tokens | M1 |
| Local food search | Bundled SQLite + FTS5 through a repository interface | M1 |
| Diary/profile/weights | Mutable user SQLite database with explicit migrations | M1 |
| Export | JSON/CSV encoder + native share sheet/web download | M1 |
| Charts | Expo-compatible React Native renderer plus accessible textual summaries | M1 basic; later advanced |
| Barcode | Expo Camera adapter; normalized UPC-A/EAN-8/EAN-13; duplicate suppression | M2 |
| Label OCR | On-device native adapters in a development build; editable draft only | M2 |
| Health data | HealthKit and Health Connect adapters with granular consent | M2 |
| Cloud sync | Cross-platform service selected only after privacy/conflict review | M2+ |
| Billing | Platform billing adapter with localized storefront products | M3 |
| AI photo/describe | Explicit opt-in backend flow with deletion and cost controls | M3+ |
| Widgets/watch | Platform extensions consuming a narrow shared summary contract | Post-MVP |

## Visual-system decision

The interactive HTML library at `/workspace/macrofactor-codex-research/design-system/` is the visual source of truth. The Expo port should preserve the following product grammar without copying branded material:

- neutral multi-step light and dark surface stacks;
- flat cards with 10–14 px radii and compact panels/sheets with 14–18 px radii;
- a 4 px base and 8 px primary spacing rhythm;
- monochrome inverse selected states before accent color;
- nutrient colors reserved for semantic data: energy blue, protein coral, fat yellow, carbs green, weight trend purple, and expenditure coral;
- dense food rows around 52–60 px with one-line nutrient metadata and 44×44 minimum effective touch targets;
- compact phone layouts validated at 390, 414, and 430 CSS-point widths;
- quiet educational callouts, with red reserved for errors and destructive actions;
- light/dark, large-text, screen-reader, RTL, reduced-motion, offline, empty, loading, and error validation.

The HTML/CSS/JavaScript files are not bundled into the product. Components are re-authored with React Native primitives and semantic tokens. Research screenshots and branded reference assets remain outside the shipping app.

## Milestone 1 screen cut

The issue #11 screen inventory remains valid after the stack change:

| Screen | Expo acceptance direction |
| --- | --- |
| Launch/gate | Opens offline and routes to onboarding only when required local profile fields are absent; no forced account. |
| Onboarding lite | Adult gate, units, biometrics, goal/rate, starter targets, preserved back navigation, and exclusion handling. |
| Today | Date navigation, calorie/P/C/F totals, four default meal slots, offline entries, combined screen-reader macro summary. |
| Food search | Warm local results target under 150 ms; source/per-100 g visible; Recent/Favorites/My Foods; explicit offline behavior. |
| Food log sheet | Decimal quantity, grams/household servings, live nutrient math, meal/time, validation, atomic commit, and undo. |
| Custom food | Manual fields and unit validation; unavailable nutrients stay distinct from zero; saved foods remain editable. |
| Progress | Weigh-in CRUD, accessible basic chart, sparse-data explanation, and no coaching claim before calibration. |
| Settings | Profile, targets, units, export/delete, licenses, data sources, and privacy. |
| Export | Complete user-owned profile/diary/weight/target data in CSV and JSON, offline and without premium. |

Barcode/network providers, recipes, health sync, adaptive coaching, paywall, cloud AI, widgets, and watch support remain outside M1.

## Billing and sync corrections

The original report’s StoreKit-only product prescription is replaced by one logical entitlement model mapped to Apple and Google storefront products. Monthly and annual products may share one premium entitlement. Prices, trial eligibility, renewal terms, restore behavior, and territory availability come from the active storefront; none are hard-coded from competitor research.

M1 is single-device and local. Before introducing sync, engineering must define encryption, authentication, stable identifiers, tombstones, conflict resolution, deletion/export behavior, data residency, incident response, and a migration path from the local database. An Apple-only CloudKit choice must not be allowed to silently exclude Android.

## Unchanged safety and release gates

- No bundled Open Food Facts subset before written ODbL/DbCL/CC BY-SA review.
- No commercial provider credential or shared USDA key in the app bundle.
- No cloud photo/describe feature before explicit consent, processor/retention disclosure, EXIF stripping, deletion workflow, and a non-AI path.
- No adaptive target beta before registered-dietitian/medical review of eligibility, exclusions, calorie floors, rates, warnings, and eating-disorder-sensitive language.
- No external iOS or Android beta before privacy/security, accessibility, store-operations, and name/trademark review.
- No competitor pricing or behavior claim is treated as current without re-verification at the time it is used.

## Open decisions and owners

| Decision | Reconciled recommendation | Gate |
| --- | --- | --- |
| Original app name | Choose before bundle/package IDs, legal pages, provider User-Agent, or store assets | Product + trademark counsel |
| Expo native integration policy | Prefer Expo-supported modules; require an adapter and development-build test for custom native code | Architecture review |
| User-data database library | Use Expo-compatible SQLite with explicit migrations; benchmark before locking the abstraction | M1 persistence task |
| Cross-platform sync provider | Defer until privacy, conflict, deletion, and operating-cost requirements are approved | M2 architecture review |
| OFF local subset | Do not ship in MVP | Counsel before any offline pack |
| Adaptive safety | Retain conservative gates; do not ship without clinical sign-off | Coaching beta |
| AI provider | On-device OCR first; cloud provider later | Privacy/security/product review |

## Definition of ready for Expo implementation

Issue #11 is reconciled when reviewers agree that:

1. React Native/Expo is the sole shipping client direction.
2. The catalog and user-data stores are separate, portable, and accessed through TypeScript repositories.
3. Apple- and Android-specific capabilities are adapters, not app architecture.
4. The HTML design-system library is the visual source of truth, with branded/trademarked assets excluded.
5. M1 remains an offline-first manual diary and does not inherit M2/M3 scope.
6. Legal, clinical, privacy/security, accessibility, store, and trademark gates remain explicit.

After explicit human approval of this document, work may proceed to issue #12. Until then, no later issue or M1 task should be started.
