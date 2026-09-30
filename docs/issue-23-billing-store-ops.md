# Issue #23 — Cross-platform billing and store operations (Expo reconciliation)

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-billing-store.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/`.  
**Source issue:** [NicholasTamm/Macro-tracker #23](https://github.com/NicholasTamm/Macro-tracker/issues/23)  
**Policy source:** [#14 freemium matrix](./issue-14-freemium-matrix.md). **Delivery tasks:** [#13 MVP backlog](./issue-13-mvp-backlog.md) (M3-09 … M3-11, M3-18). **Privacy constraints:** [#22](./issue-22-privacy-security.md).  
**This issue owns** the store-operations contract (one logical premium entitlement, localization, purchase/restore matrix, server-notification prerequisites). It does **not** ship IAP SDK code in M1.

## Supersession notice

Swift-era StoreKit-only / `SubscriptionStoreView`-only / Apple-receipt-only prescriptions from research OUT and early freemium wording are **superseded** for Macro-tracker implementation. Product rules remain binding: one premium capability set, store-localized offers only, free diary/export/deletion never gated, no hard-coded competitor pricing.

| Research-era prescription | Expo / RN decision |
| --- | --- |
| StoreKit 2 + `SubscriptionStoreView` as sole IAP UI | Cross-platform entitlement service: **iOS StoreKit 2** + **Android Google Play Billing**. Paywall UI in `software/modules/paywall/` consumes a platform-neutral entitlement API. Concrete SDK (e.g. `react-native-iap`, RevenueCat, or Expo-compatible wrapper) is an **M3** choice — not M1. |
| One Apple subscription group only | One **logical** product family mirrored on **App Store Connect** and **Google Play Console**: `premium.monthly` + `premium.annual`. Identical feature unlock; annual is billing discount only. |
| Apple receipt / ASN validation only | Backend (when premium cloud features exist) validates **active-platform** entitlement: App Store Server Notifications v2 **and** Google Play Real-time Developer Notifications (RTDN) + purchase-token verification. |
| Hard-coded USD / competitor prices in UI or docs | **Forbidden as live offer policy.** Display only store-localized price, period, trial eligibility, renewal terms, and store policy links from the active storefront. |
| IAP in M1 | **Deferred to Milestone 3.** M1 paywall module remains a shell (`enabledByDefault: false`). |

**Pointers**

- Freemium matrix (#14): [`docs/issue-14-freemium-matrix.md`](./issue-14-freemium-matrix.md)
- MVP backlog (#13): [`docs/issue-13-mvp-backlog.md`](./issue-13-mvp-backlog.md) — M3-09 products, M3-10 entitlement service, M3-11 paywalls, M3-18 storefront validation
- Privacy / entitlement assertions (#22): [`docs/issue-22-privacy-security.md`](./issue-22-privacy-security.md)
- Paywall module shell: [`software/modules/paywall/`](../software/modules/paywall/)
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)

**Hard exclusions (unchanged):** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering. No ads or sale of nutrition/health profiling data. Never paste a competitor’s price into product copy or treat it as our offer.

---

## Goal

Define and verify **one logical premium entitlement** across Apple StoreKit and Google Play Billing so that:

1. Monthly and annual storefront products unlock the **same** in-app capability set on iOS and Android.
2. Price, period, offer eligibility, renewal terms, and territory availability always come from the **active storefront**.
3. Purchase, pending, cancel, refund, revoke, billing retry, grace, offline cache, restore, and account-switch behaviors are testable before external paid beta.
4. After lapse, approved free features (manual diary, export, deletion, local USDA search, etc.) remain fully available.

---

## Logical entitlement model

### Product family

| Logical ID | App Store product (example SKU) | Play Billing product (example) | Period | Unlocks |
| --- | --- | --- | --- | --- |
| `premium.monthly` | Auto-renewable in one subscription group | Subscription base plan (monthly) under one subscription | 1 month | Full premium matrix (#14) |
| `premium.annual` | Same group, annual | Same subscription, annual base plan | 1 year | **Identical** to monthly (billing discount only) |

Exact store SKUs are configured in App Store Connect / Play Console at M3-09 — **do not commit live price strings** into the repo as policy.

### Entitlement states (app-facing)

| State | Meaning | Source of truth |
| --- | --- | --- |
| `free` | Default; full free matrix | Always |
| `premiumTrial` | Introductory offer / free trial in progress | Verified store transaction + offer metadata |
| `premium` | Paid active subscription | Verified store transaction + renewal state |
| `premiumGrace` | Billing retry / account hold / grace window | Store billing-retry / grace flags (platform-specific) |
| `premiumLapsed` | Expired / refunded / revoked → treat as `free` for gates | Store revocation / expiry; clear premium gates only |

App feature gates consume **only** these logical states. Platform adapters map StoreKit `Product` / `Transaction` / `RenewalInfo` and Play `ProductDetails` / `Purchase` / subscription status into the same model.

### Mapping rules (binding)

1. **One capability set.** `premium.monthly` and `premium.annual` on either store unlock the same gates (`premium` / `premiumTrial`). No “annual-only” features.
2. **Cross-platform identity.** A user who buys on iOS does **not** automatically get Play entitlement (and vice versa) until a future account-linked restore strategy ships. Document this in Settings/Help. Do not fake cross-store restore.
3. **Upgrade / downgrade / resubscribe.** Prefer store-native subscription group / base-plan change APIs; app must re-fetch entitlement after any change and never invent mid-cycle capability differences.
4. **No diary upload for IAP.** Billing flows must not send nutrition diary, health samples, or AI media to the store or to a billing proxy ([#22](./issue-22-privacy-security.md)).

---

## Localized prices and offers (no hard-coded competitor pricing)

| Must load from storefront | Must never hard-code as live policy |
| --- | --- |
| Display price string (localized currency) | Competitor app prices |
| Subscription period / billing cadence | Static `$X.XX/mo` committed as “our price” in UI or marketing docs |
| Introductory / free-trial eligibility | Assumed 7-day trial for every territory |
| Renewal / cancel / manage deep-link copy required by store | Prices copied from screenshots into source |
| Territory availability (product not returned → hide or show unavailable) | “Available worldwide” without store evidence |

**Rule:** Paywall and Settings copy bind to `Product.displayPrice` / Play equivalent (or entitlement-service wrappers). Docs and README may describe *process* (“monthly and annual localized products”) but must not assert a numeric retail price as policy.

Introductory offers: configure a seven-day full-premium trial **where the store territory and eligibility rules allow**. Eligibility is store-decided (new subscriber rules differ per platform); the app must handle ineligible users without implying a trial.

---

## Milestone timing

| When | Billing posture |
| --- | --- |
| **M1** | No IAP. Paywall module is a shell. Entire diary path free; export/delete ungated. |
| **M2** | Still no hard paywall for core diary. May add free allowances for remote food/OCR. Entitlement service design may spike; no production purchases. |
| **M3** | M3-09 configure products + intro offers (sandbox). M3-10 entitlement service, listeners, restore/manage, billing-retry/grace tests. M3-11 contextual paywalls per [#14](./issue-14-freemium-matrix.md). M3-18 US/CA (+ Android target territories) storefront evidence before paid beta. |
| **Before external paid beta** | Server-notification + backend entitlement requirements documented and implemented for any cloud/AI premium path; store copy + subscription disclosure review complete. |

---

## Architecture (Expo)

```
┌─────────────────────────────────────────────────────────────────┐
│ Expo RN client                                                  │
│  software/modules/paywall/                                      │
│    PaywallUI ──► EntitlementService (logical states)            │
│                      │                                          │
│         ┌────────────┴────────────┐                             │
│         ▼                         ▼                             │
│   StoreKitAdapter (iOS)    PlayBillingAdapter (Android)         │
│   - products / offers      - ProductDetails / offers            │
│   - purchase / restore     - launchBillingFlow / restore        │
│   - Transaction updates    - PurchasesUpdatedListener           │
│   - offline entitlement    - offline entitlement cache          │
│     cache (signed/short)     cache (signed/short)               │
└───────────┬───────────────────────────┬─────────────────────────┘
            │                           │
            ▼                           ▼
   App Store Server API /        Google Play Developer API /
   Server Notifications v2       RTDN (Pub/Sub)
            │                           │
            └──────────► Backend entitlement store (M3+)
                         - maps store txn → user / device assertion
                         - gates AI / sync / vendor proxy when those exist
                         - never required for local free diary
```

**SDK decision (M3):** Evaluate Expo-compatible options (`react-native-iap`, RevenueCat, custom native modules via config plugin). Criteria: StoreKit 2 + Play Billing Library current major, sandbox/test-track support, restore APIs, offline cache hooks, no requirement to upload diary for analytics, EAS Build / dev-client fit. Record the choice in this doc when picked — not in M1.

---

## Purchase and restore flows

### Happy-path purchase

1. User hits a contextual premium action ([#14](./issue-14-freemium-matrix.md) triggers) → paywall shows store-localized products.
2. User selects monthly or annual → platform purchase sheet.
3. On success: finish / acknowledge transaction (StoreKit `finish`; Play `acknowledgePurchase`); update `EntitlementService` → `premium` or `premiumTrial`.
4. UI unlocks premium gates; **Continue Free** path remains available if purchase cancelled/dismissed.
5. Persist a short, documented offline entitlement cache (signed expiry / grace); reconcile on next network + store session.

### Restore purchases

1. **Restore Purchases** visible on paywall and in Settings (equal clarity to purchase CTA).
2. Call platform restore / current-entitlements APIs (StoreKit current entitlements; Play query purchases + history as appropriate).
3. Map any active subscription to logical `premium` / `premiumTrial` / `premiumGrace`.
4. If none: stay `free`; show calm empty state — never delete diary data.
5. **Manage Subscription** deep-links to App Store / Play subscription management (platform URLs), not a custom cancel dark pattern.

### Account switch

| Scenario | Expected behavior |
| --- | --- |
| Same device, different store account | Re-query store; entitlement follows **store account**, not device alone |
| App account (future) linked to store | Document linking rules before enabling; never silently merge diaries across people |
| Entitlement lost after switch | Gates → free; diary/export/delete remain |

---

## Lifecycle test matrix (M3-10 acceptance)

| Case | StoreKit | Play Billing | App expectation |
| --- | --- | --- | --- |
| Purchase success | Sandbox buy | License tester / test track | → `premium` / `premiumTrial`; finish/ack |
| Pending (Ask to Buy / slow debit) | Pending transaction | Pending purchase | Show pending UI; no false premium; diary usable |
| User cancel / dismiss | `userCancelled` | `USER_CANCELED` | Stay prior state; no error guilt |
| Refund | Notification + status | Voided purchase RTDN | → free gates; data retained |
| Revoke / chargeback | Revocation | Revocation / cancel | → free gates immediately on verify |
| Billing retry / grace | `billingRetry` / grace period | Account hold / grace | → `premiumGrace` per documented window; then free |
| Offline with valid cache | Cached entitlement | Cached entitlement | Honor short cache; reconcile on reconnect |
| Offline expired cache | — | — | Fail closed to free for **premium gates**; free features work |
| Restore with active sub | Current entitlements | Query purchases | Unlock premium |
| Restore with none | Empty | Empty | Free; no data loss |
| Upgrade monthly→annual | Subscription group change | Base-plan change | Same capability; price/period refresh |
| Lapse after cancel | Expiry | Expiry | Free gates; diary/export/delete/local USDA intact |

**Always-free after lapse (binding):** manual diary, history, export (CSV/JSON), account/data deletion, local USDA Foundation + SR Legacy search, manual targets, Quick Add / custom foods — per [#14](./issue-14-freemium-matrix.md). Receipt/transaction errors must **never** hide or delete local diary data.

---

## Server notifications and backend entitlement (before premium backend access)

Required **before** enabling any premium cloud feature (AI upload, vendor proxy allowance beyond free, automatic multi-device sync gated by premium):

| Requirement | Apple | Google |
| --- | --- | --- |
| Real-time updates | App Store Server Notifications V2 | Play Real-time Developer Notifications |
| Verification | Signed JWS transactions / Server API | Purchase token + Play Developer API |
| Idempotent store | Upsert by original transaction / order ID | Upsert by purchase token / order ID |
| Mapping | Device assertion and/or future user ID | Same |
| Failure mode | If backend cannot verify → **no cloud premium upload**; local free path remains | Same |
| Privacy | No diary/health/AI payloads in billing webhooks or logs ([#22](./issue-22-privacy-security.md)) | Same |

Until backend entitlement ships, **on-device store verification + offline cache** may gate local-only premium (e.g. adaptive coaching estimator) if product chooses — but any network premium path needs the table above.

---

## Storefront evidence (M3-18)

Before external paid beta / launch:

1. Capture fresh purchase-sheet evidence for **US** and **Canadian** storefronts (price, period, trial eligibility, renewal disclosure) on **iOS and Android**.
2. Add Android **target territories** list (minimum: US + CA; expand as Play Console targets are approved).
3. Store evidence outside source (designated launch folder / issue attachment) — **do not** commit live price screenshots as canonical policy into git if they will stale; link from the launch checklist instead.
4. Re-check immediately before launch (prices and offers change).

---

## Store copy and subscription disclosure

Before external paid beta:

- Privacy policy, terms, and subscription auto-renewal disclosure match store questionnaires ([#22](./issue-22-privacy-security.md) / M3-17).
- Paywall shows: localized price, period, what happens on trial end, link to manage/cancel, privacy + terms links.
- No fake urgency, preselected paid plans that obscure Continue Free, or hard-to-find restore.
- Accessibility: Continue Free equal clarity; Reduce Motion respected; VoiceOver / TalkBack labels on purchase and restore.

---

## Milestone / task mapping

| Backlog ID | This issue’s expectation |
| --- | --- |
| M3-09 | Create `premium.monthly` / `premium.annual` on both stores; intro offer where eligible; sandbox / license testers verified. |
| M3-10 | Entitlement service + adapters; full lifecycle matrix above; restore/manage; offline cache; free data never hidden. |
| M3-11 | Contextual paywalls; gates per [#14](./issue-14-freemium-matrix.md); no blocking launch paywall. |
| M3-18 | US/CA (+ Android targets) storefront evidence immediately pre-launch. |
| M3-17 | Legal/privacy subscription disclosure review (shared with privacy issue). |

---

## Out of scope for this docs PR

- Choosing or wiring a concrete IAP SDK.
- App Store Connect / Play Console product creation (needs store accounts at M3).
- Backend notification endpoints implementation.
- Paywall visual design beyond the module shell.
- Merging this branch — **awaiting Nicholas approval**.

---

## Bottom line

One logical premium entitlement (`free` / `premiumTrial` / `premium` / `premiumGrace`) backed by mirrored monthly+annual products on StoreKit and Play Billing; prices and offers always from the active storefront; no competitor or static USD hard-codes as live policy; full purchase/restore/lifecycle matrix in M3; free diary/export/deletion survive lapse; server notifications required before any premium backend access.
