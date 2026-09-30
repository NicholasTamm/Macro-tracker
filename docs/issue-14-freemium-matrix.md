# Issue #14 — Freemium matrix (Expo reconciliation)

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-freemium-matrix.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/`.  
**Source issue:** [NicholasTamm/Macro-tracker #14](https://github.com/NicholasTamm/Macro-tracker/issues/14)  
**Research OUT (Swift-era, superseded for implementation):** `/workspace/macrofactor-codex-research/OUT/freemium-matrix.md`

## Supersession notice

StoreKit-only / CloudKit / HealthKit / Apple Watch / Siri / App Intents / `SubscriptionStoreView` prescriptions in the research OUT doc and the original GitHub issue #14 body are **superseded** for Macro-tracker implementation. Product principle, free-vs-premium capability split, paywall ethics, fair-use rules, and “never gate diary/export/deletion” remain binding.

| Research prescription | Expo / RN decision |
| --- | --- |
| StoreKit 2 + `SubscriptionStoreView` as sole IAP | Cross-platform IAP behind an entitlement service (iOS StoreKit + Android Play Billing). Concrete SDK (e.g. `react-native-iap`, RevenueCat, or Expo-compatible wrapper) is an **M3** decision — not M1. |
| One StoreKit subscription group only | One logical product family: `premium.monthly` + `premium.annual` mirrored on App Store Connect **and** Google Play Console. Identical feature unlock; annual is billing discount only. |
| CloudKit sync/backup as premium convenience | **No sync in M1.** Later sync must be cross-platform; CloudKit is not the default system of record. Premium may unlock automatic multi-device sync when a sync stack ships. |
| HealthKit weight free / nutrition premium | Platform-neutral health interface: iOS HealthKit + Android Health Connect adapters. Weight import stays free; nutrition read/write remains premium until research says otherwise. |
| Apple Watch / Siri / App Intents / rich widgets | Optional post-M3 surfaces behind feature flags; not M1/M2 blockers. Free may keep one basic home-screen widget when widgets ship. |
| Hard-coded competitor or App Store prices in UI/docs | **Forbidden as policy.** Display only store-localized price, period, trial eligibility, renewal terms, privacy, and terms from the active store. Never paste a competitor’s price into product copy. |
| Backend validates Apple entitlement only | Backend (when AI/cloud features exist) validates the active-platform entitlement or a signed app assertion; no upload without entitlement/allowance. |

**Pointers**

- MVP backlog (#13): [`docs/issue-13-mvp-backlog.md`](./issue-13-mvp-backlog.md) (merged) · M3-10/M3-11 own IAP + paywall tasks
- Food schema (#12): [`docs/issue-12-food-schema-seed-contract.md`](./issue-12-food-schema-seed-contract.md)
- Paywall module shell: [`software/modules/paywall/`](../software/modules/paywall/)
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)
- Design system (RN): [`software/design-system/`](../software/design-system/)

**Hard exclusions (unchanged):** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering. No ads or sale of nutrition/health profiling data.

---

## Product principle

The free tier must remain a trustworthy, complete manual nutrition diary. Premium sells adaptive intelligence, cross-device convenience, and compute-heavy automation—not ownership of the user’s data, accessibility, basic food lookup, or the ability to leave.

## Proposed matrix (Expo-reconciled)

| Capability | Free forever | Premium | Rationale / guardrail | Milestone |
| --- | --- | --- | --- | --- |
| Onboarding and transparent starter targets | Full | Full | A usable start cannot depend on payment. Targets are estimates, not medical advice. | M1 |
| Today diary and history | Unlimited | Unlimited | Do not hold history hostage or impose a 7/30-day deletion cliff. | M1 |
| Local USDA Foundation + SR Legacy search | Full, offline | Full | Core free-first promise; no marginal data fee. | M1 |
| Manual Quick Add and custom foods | Unlimited | Unlimited | Essential escape hatch and user-owned content. | M1 |
| Open Food Facts barcode lookup | Full, fair-use limits | Full, same source limits | Open data should not be paywalled. Premium does not bypass OFF’s public rate limits. | M2 |
| USDA Branded fallback | Full with reasonable app-side rate protection | Full | Free public source; use only after OFF miss. | M2 |
| Serving editor, favorites, recents | Full | Full | Core logging speed, no meaningful premium value alone. | M1 |
| Meal slots and timestamps | Full | Full | Basic diary organization. | M1 |
| Copy single entry / meal | Full | Full | Baseline usability. | M1–M2 |
| Copy entire day / multi-day plans | — | Full | Convenience feature with clear premium value. | M2+ |
| Custom recipes | Up to 5 active recipes | Unlimited | Free users can evaluate; premium removes a storage/organization cap. Never block access to already logged history. | M2 |
| Weight logging and basic trend chart | Full | Full | Progress basics and data visibility stay free. | M1 |
| Advanced chart ranges/overlays | 30-day weight + intake | All-time, comparison ranges, nutrient timing | Premium analytics without obscuring current health data. | M3 |
| Adaptive expenditure estimate (`TransparentTrend v1`) | Read-only 14-day trial preview | Ongoing | Main premium value. Preview must state calibration/uncertainty. Pure TypeScript estimator. | M3 |
| Weekly target check-ins | Trial preview | Full | Premium coaching; every proposed change remains opt-in. | M3 |
| Advanced insights | Occasional educational cards | Personalized trend/coaching cards | Charge for derived interpretation, not raw data. | M1 cards free; M3 personalized |
| Manual targets | Full | Full | Users should not have to subscribe to control their own targets. | M1 |
| Label OCR | 5 successful scans/month | Unlimited reasonable use | On-device via platform adapters; small free allowance aids conversion and accessibility. Always produces an editable draft. | M2–M3 |
| AI photo/Describe | 3 analyses in initial trial; none recurring by default | Monthly fair-use allowance, clearly displayed | Cloud inference has real cost/privacy impact. Offer add-on packs only if needed; never silently throttle after upload. | M3 (flagged) |
| Health weight import (HealthKit / Health Connect) | Full | Full | Reduces logging friction and improves accessibility. | M2+ |
| Health nutrition read/write | — | Full | Integration convenience; granular consent and revocation. | M2+ |
| Multi-device sync/backup | Single-device local free; optional one-time manual backup/export | Automatic multi-device sync (cross-platform stack TBD) | Premium convenience. Export remains free. Consider making sync free later if retention/support data favors it. **Not CloudKit-default.** | post-M1 |
| Widgets | One basic read-only macro widget | All widgets and quick actions | Free preview with premium depth. | post-M3 |
| Wear OS / watchOS complications | — | Full | Separate target and maintenance cost; optional. | post-M3 |
| Voice / App Intents / shortcuts | Basic “log weight / open search” where platform allows | Rich recent-food/meal intents | Do not gate accessibility-critical actions without review. | post-M3 |
| CSV/JSON export | Complete, unlimited | Complete, unlimited | User data portability is not a premium feature. | M1 |
| Account/data deletion | Full | Full | Privacy right, never paywalled. | M1+ |
| Data-source/license details | Full | Full | Attribution and provenance must always be visible. | M1 |
| Ads / data sale | None | None | Monetize subscriptions, not sensitive nutrition/health profiling. | always |

## Trial and products (M3 — StoreKit / Play later)

IAP is **out of Milestone 1**. When M3 ships premium:

- One logical subscription family with `premium.monthly` and `premium.annual` on **both** App Store Connect and Google Play Console.
- Seven-day full-premium introductory trial where the store territory/eligibility rules allow it (store-configured, not hard-coded).
- Monthly and annual unlock identical functionality; annual is a billing discount, not a higher tier.
- Do not add a semiannual product to MVP. Two choices reduce paywall friction and test burden.
- **Display only store-localized** price, period, trial eligibility, renewal terms, privacy, and terms. Never hard-code a competitor’s price or a static USD string into UI or marketing docs as the live offer.
- Trial cancellation or lapse returns the account to Free without deleting data or disabling export.
- Paywall UI lives in `software/modules/paywall/` and must work offline for entitlement cache display; purchase flows require network + store session.

## Entitlement rules

| Entitlement | Source of truth | Offline behavior |
| --- | --- | --- |
| `free` | Always available | Full free feature set |
| `premiumTrial` | Verified store transaction/offer (StoreKit or Play Billing via entitlement service) | Cache verified entitlement through its signed expiry/grace state |
| `premium` | Verified store transaction and transaction updates | Allow a short, documented offline grace period; reconcile on network return |
| Backend AI/vendor access | Backend validates active-platform entitlement or signed app assertion | No upload if entitlement/allowance cannot be established; manual/OCR fallback remains |

Receipt/transaction errors must never hide or delete local diary data. **Restore Purchases** and **Manage Subscription** are visible in Settings and on the paywall (store deep-links or in-app restore APIs as appropriate per platform).

## Paywall triggers

Use contextual, dismissible paywalls only when a person asks for a premium action:

- Start adaptive coaching/check-in.
- Open an advanced insight or all-time comparison.
- Create recipe 6.
- Enable automatic sync, full widgets, wear surfaces, or nutrition health sync.
- Exceed the free OCR/AI allowance.

Do not show a blocking launch paywall. Onboarding may show a soft premium explanation after the user reaches a usable Today screen, but **Continue Free** receives equal visual clarity (a11y + Reduce Motion).

## Fair-use and failure behavior

- Cloud AI allowance is disclosed numerically before capture/upload. A failed analysis does not consume an allowance.
- OFF and USDA outages affect Free and Premium equally; premium does not promise provider availability the app does not control.
- If a vendor is removed for terms/cost reasons, logged user history remains readable subject to the accepted contract. Shared vendor caches are purged according to policy.
- Free users receive the same data-quality warnings, provenance, accessibility, privacy controls, and safety floors.

## Why this split is sustainable

Free features mostly use on-device storage and redistributable/open data: USDA FDC is CC0/public domain and OFF is reusable under ODbL conditions. ([USDA API/licensing](https://fdc.nal.usda.gov/api-guide/), [OFF licensing](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)) Premium concentrates recurring value and cost in computation, product intelligence, sync support, and multi-surface integrations.

## Metrics and review gates

Track with privacy-preserving, aggregate events only:

- Time to first logged food and day-7 diary retention.
- Local-search success, barcode hit/miss by provider, and manual-fallback completion.
- Trial start → coaching calibration → first accepted/declined check-in.
- Paywall view → purchase by trigger, refund rate, and cancellation path completion.
- AI success/correction rate and cost per successful analysis.
- Free-to-paid conversion without degrading free diary completion.

Review the matrix after 8–12 weeks of real usage. If a gate harms core logging or accessibility, move it to Free. Do not use dark patterns, fake urgency, preselected consent, or difficult cancellation.

## Items to verify before launch (M3 / store)

- Final prices and introductory offers per territory in App Store Connect **and** Google Play Console (never commit live prices into the repo as policy copy).
- Subscription grace/billing-retry behavior and backend entitlement propagation for both stores.
- Whether health nutrition sync should be free after user research.
- Cloud AI processor cost, retention, and contract before choosing the monthly allowance.
- Legal review of the phraseology used around coaching, results, and trials.
- Choice of IAP SDK / entitlement service and its Expo / dev-client compatibility.

## Milestone mapping (summary)

| When | Freemium posture |
| --- | --- |
| **M1** | Entire diary path is free; no paywall enforcement; export/delete ungated; paywall module is a shell only. |
| **M2** | Remote food/OCR may add free allowances; still no hard paywall required for core diary. |
| **M3** | IAP + entitlement gates per this matrix; contextual paywalls; free diary/export remain ungated. |
| **Post-M3** | Widgets, wear, rich intents, optional sync depth — behind flags and this matrix. |
