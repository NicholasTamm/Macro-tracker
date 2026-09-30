# Issue #22 — Privacy and security architecture (Expo reconciliation)

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-privacy-security.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/`.  
**Source issue:** [NicholasTamm/Macro-tracker #22](https://github.com/NicholasTamm/Macro-tracker/issues/22)  
**Release-gate lineage:** Privacy/security gate from [#11](https://github.com/NicholasTamm/Macro-tracker/issues/11); implementation tasks live in [#13](./issue-13-mvp-backlog.md) (esp. M1-21, M2-16, M3-14, M3-17). This issue owns the **cross-feature threat model and approval record**, not feature code.  
**Not legal advice.** Counsel must review privacy policy, store questionnaires, processor DPAs, and retention promises before external network / health / sync / AI betas.

## Supersession notice

Swift-era Keychain / CloudKit / HealthKit-only / VisionKit-only prescriptions from research OUT and issue #11 are **superseded** for Macro-tracker implementation. Product and safety requirements remain binding: no commercial secrets in the client, no secrets in AsyncStorage, granular health consent, EXIF stripping for AI uploads, export/deletion never gated, and no sale of nutrition/health profiling data.

| Research-era prescription | Expo / RN decision |
| --- | --- |
| iOS Keychain for tokens/secrets | **`expo-secure-store`** (Keychain on iOS, EncryptedSharedPreferences / Keystore-backed on Android) for refresh tokens, device-bound assertions, biometric-gated flags. Never AsyncStorage. |
| CloudKit as sync / container model | **No sync in M1.** Later sync is cross-platform (#19); CloudKit is not the system of record. Sync threat model applies when a stack is chosen. |
| HealthKit-only purpose strings | Platform-neutral health interface: **HealthKit (iOS) + Health Connect (Android)** adapters in `software/modules/health-sync/`. Dual consent, revocation, and logging rules below. |
| Secrets never in IPA | Secrets never in the **Expo / EAS binary** (iOS or Android). Commercial provider keys and shared USDA production keys live only in a server secrets manager + proxy. |
| VisionKit on-device OCR | On-device OCR via Expo-compatible / platform adapters first; cloud photo/describe is post-MVP, opt-in, behind entitlement + privacy gates ([#14](./issue-14-freemium-matrix.md)). |
| App Store privacy nutrition label only | Map design to **Apple Privacy Manifest + App Privacy** **and** **Google Play Data safety** before store submission. |

**Pointers**

- Food schema / storage boundary (#12): [`docs/issue-12-food-schema-seed-contract.md`](./issue-12-food-schema-seed-contract.md)
- MVP backlog (#13): [`docs/issue-13-mvp-backlog.md`](./issue-13-mvp-backlog.md) (PR may still be open)
- Freemium / AI allowance (#14): [`docs/issue-14-freemium-matrix.md`](./issue-14-freemium-matrix.md) (PR may still be open)
- Provider constraints (#15): [`docs/issue-15-source-verification-log.md`](./issue-15-source-verification-log.md) (PR may still be open)
- Sync architecture (#19): open — this doc constrains any future choice
- Health module shell: [`software/modules/health-sync/`](../software/modules/health-sync/)
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)

**Hard exclusions (unchanged):** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering. No ads or sale of nutrition/health profiling data.

---

## Scope and data classes

| Class | Examples | Sensitivity | Default residence (M1) |
| --- | --- | --- | --- |
| **Nutrition diary** | Meal entries, nutrient snapshots, custom foods/recipes, favorites/recents | High (health-adjacent) | `UserData.sqlite` (expo-sqlite), device-local |
| **Weight / body** | Manual weigh-ins, imported body-mass samples, outlier flags | High | `UserData.sqlite`; health import only after consent |
| **Profile / targets** | Age band, sex, height, goals, units, theme | Medium–High | `UserData.sqlite` / small prefs; not telemetry |
| **Health-platform** | HealthKit / Health Connect read/write scopes, last sync anchors | High | Consent state + anchors; samples merge into user store with provenance |
| **Provider cache** | OFF/FDC Branded hits, optional FatSecret IDs/payloads | Medium (license + PII-adjacent when tied to user) | Short-lived local cache with provenance; never into `FoodSeed.sqlite` |
| **Entitlement** | Store transaction state, offline grace cache | Medium | Verified store APIs + short signed cache; not a substitute for diary encryption policy |
| **Secrets / credentials** | Provider OAuth client secrets, shared USDA keys, proxy HMAC, attestation keys | Critical | **Server secrets manager only**; device may hold opaque short-lived session tokens in SecureStore |
| **AI media** | Food photos, describe text, model outputs | High | Ephemeral upload path; strip EXIF; delete originals on schedule; editable draft only |
| **Telemetry** | Aggregate crash / funnel events | Low only if scrubbed | Opt-in or privacy-preserving aggregates; **never** diary payloads, health samples, photos, or secrets in logs |

---

## Storage decision (Expo)

| Store | Allowed contents | Forbidden contents |
| --- | --- | --- |
| **`FoodSeed.sqlite`** (bundled, read-only) | Curated USDA Foundation + SR Legacy | User diary, tokens, vendor secrets, OFF/FatSecret rows |
| **`UserData.sqlite`** (expo-sqlite) | Diary, weights, custom foods, profile, coaching state, health-import provenance | API keys, OAuth client secrets, refresh tokens, attestation private keys |
| **`expo-secure-store`** | Refresh / session tokens, device-bound attestation handles, biometric unlock flags, encrypted backup wrapping keys (when sync ships) | Large domain blobs (use SQLite); plaintext provider secrets |
| **AsyncStorage** | Small **non-sensitive** prefs only (theme, units display, onboarding step, UI dismissals, recoverable drafts **without** secrets) | **Any secret, token, API key, entitlement signature, health sample, diary payload, or AI media** |
| **OS photo / filecache** | User-chosen exports; temporary AI capture buffers wiped after upload/cancel | Long-lived unstripped EXIF originals of AI uploads |
| **EAS / app config / env in binary** | Public URLs, non-secret feature flags, build channel | Commercial provider keys, shared USDA production keys, proxy signing keys |

**Rule (binding):** Commercial secrets and shared USDA production keys **never ship in the app bundle**. AsyncStorage is **not** a secret store. Prefer SecureStore for any credential-shaped value; prefer expo-sqlite for domain data.

---

## Data-flow outline (ASCII)

```
┌──────────────────────────────────────────────────────────────────────┐
│ DEVICE (Expo RN)                                                     │
│  UI / modules: diary, food-catalog, coaching, health-sync, paywall   │
│                                                                      │
│  FoodSeed.sqlite ──read-only──► LocalFoodRepository                  │
│  UserData.sqlite ◄────────────► Diary / Weight / Profile repos       │
│  expo-secure-store ◄──────────► session / attestation handles        │
│  AsyncStorage ──prefs only──► theme/units/UI (NO secrets)            │
└───────────┬───────────────────────────────┬──────────────────────────┘
            │                               │
            │ HTTPS (TLS)                   │ HealthKit / Health Connect
            ▼                               ▼
┌───────────────────────────┐    ┌────────────────────────────┐
│ PROVIDER PROXY (backend)  │    │ OS health platforms        │
│  - secrets manager        │    │  granular scopes           │
│  - short-lived creds      │    │  revoke → stop sync        │
│  - rate limits            │    │  no wearable EE → coaching │
│  - optional app attest    │    └────────────────────────────┘
│  - USDA / OFF / FatSecret │
│    adapters (server-side) │
└───────────┬───────────────┘
            │
            ▼ (future, flagged)
┌───────────────────────────┐    ┌────────────────────────────┐
│ AI PROCESSOR (subprocessor│    │ STORE BILLING              │
│  region disclosed)        │    │  StoreKit / Play Billing   │
│  EXIF-stripped upload     │    │  entitlement assertions    │
│  editable draft response  │    │  no diary upload for IAP   │
└───────────────────────────┘    └────────────────────────────┘
```

**M1 posture:** no provider proxy, no health sync, no AI, no multi-device sync required for the offline diary. Flows above are designed **now** so M2/M3 cannot invent incompatible storage or logging.

---

## Threat model (STRIDE-style summary)

| Asset / flow | Spoofing | Tampering | Repudiation | Info disclosure | DoS | Elevation |
| --- | --- | --- | --- | --- | --- | --- |
| **Device storage** | Stolen device / backup extract | DB edit on jailbreak/root | Local edits without audit | Unencrypted backups, AsyncStorage secrets | Disk full | Malicious module write |
| **Logs / crash** | Fake client events | — | Missing audit of deletes | Diary/health/photo in logs | Log flood | — |
| **Provider proxy** | Stolen client impersonation | Cache poison / MITM | Missing request IDs | Keys in binary; verbose errors | Abuse of shared keys | Client calling vendor directly |
| **Sync (future)** | Account takeover | Conflict / tombstone wipe | Unclear delete provenance | Sync of full diary to wrong account | Sync storms | Privilege across devices |
| **Billing assertions** | Fake “premium” offline | Clock / receipt replay | — | Receipt PII in logs | Store outage | Unlock AI without pay |
| **Cloud AI** | Upload without consent | Model output accepted as fact | No deletion proof | EXIF/GPS leak; training reuse | Cost abuse | Bypass manual path |
| **Health platforms** | Broad consent dark pattern | Duplicate / wrong source samples | — | Over-scoped read; logging samples | Sync loops | Coaching trusts wearable EE |

### Mitigations (approved design intent)

1. **Encryption / at-rest:** Rely on OS file protection / Android credential-encrypted storage for app sandbox; put credentials in **expo-secure-store**; keep domain data in sqlite files that never hold secrets. Device-passcode / biometric gate for app unlock is optional post-M1. Document whether future sync uses end-to-end vs server-side encryption before choosing #19.
2. **Secret management:** Backend secrets manager (rotated). Client receives **opaque, short-lived** tokens only. No `EXPO_PUBLIC_*` commercial keys. CI secret scanning on PRs.
3. **Short-lived credentials:** Proxy issues ≤15–60 min access tokens (exact TTL TBD with backend). FatSecret OAuth client secret stays server-side ([FatSecret OAuth](https://platform.fatsecret.com/docs/guides/authentication/oauth2)).
4. **Rate limits:** Per-user / per-device / per-IP on proxy; honor OFF public limits (15 product / 10 search req/min/IP) and USDA shared-key limits; never bypass with client-embedded keys.
5. **App attestation:** **Decision — defer mandatory attestation to first paid-provider or AI beta.** Document spike (App Attest / Play Integrity) in M2-16; allowlist mode for TestFlight / internal testing. Until then, bind proxy calls to signed short-lived app assertions + rate limits.
6. **Retention:** Diary/weight retained until user delete/export. Provider nutrient caches: per [#15](./issue-15-source-verification-log.md) (FatSecret non-ID ≤24h). AI originals: delete on processor within disclosed window (target ≤24–72h unless user explicitly saves a local draft). Logs: scrubbed aggregates; raw request bodies not retained.
7. **Deletion:** In-app account/data deletion and CSV/JSON export are **free forever** ([#14](./issue-14-freemium-matrix.md)). Deletion covers `UserData`, SecureStore tokens, health unlink, provider cache, AI artifacts (processor delete request), and future sync tombstones. Drill before external beta (M3-17).
8. **Incident response:** Maintain a one-page runbook: detect → contain (rotate keys, kill-switch feature flags) → assess (what classes leaked) → notify (users/regulators as required) → postmortem. Owner: engineering + counsel. No diary content in public status pages.
9. **Subprocessors:** Maintain a living table (proxy host, crash/analytics if any, AI processor, email/support, sync host when chosen). Disclose in privacy policy and store questionnaires before each new processor receives production traffic.

---

## Nutrition data flow

| Step | Control |
| --- | --- |
| Local USDA search | Read-only `FoodSeed`; no network; no PII leave device |
| Diary write | Snapshot nutrients into `UserData`; undo via soft-delete / history — never requires cloud |
| Remote barcode / branded (M2+) | Explicit user action → proxy or public OFF with custom User-Agent; cache with license tags; **no merge into FoodSeed** |
| Optional FatSecret | Proxy-only; IDs may persist; other fields ≤24h; attribution UI; adapter off until legal (#20) |
| Export | User-initiated CSV/JSON on device; no automatic upload |
| Logs | Log event names / error codes only — **never** food names, macros, or barcodes tied to user identity in production |

---

## Weight data flow

| Step | Control |
| --- | --- |
| Manual weigh-in | Stored in `UserData` with timestamp + source=`manual` |
| Chart / trend | On-device; coaching estimator (`TransparentTrend v1`) stays local TypeScript |
| Import from health | Only after granular body-mass consent; mark `source=healthkit|health_connect`; dedupe by timestamp±tolerance + source priority |
| Outliers | User-confirm flag; never auto-delete history |
| Logging | No weight values in analytics |

---

## Health platform (HealthKit + Health Connect)

| Topic | Rule |
| --- | --- |
| **Consent** | Per-platform OS sheets; request **minimum scopes**. Weight import free; nutrition R/W premium per [#14](./issue-14-freemium-matrix.md) but **consent UX is identical in clarity**. Purpose strings / Android rationale must match actual use. |
| **Granularity** | Separate toggles: body mass read; dietary energy / macros read; dietary write. Do not request steps/sleep/workouts for v1 coaching. |
| **Revocation** | Settings → disconnect stops queries immediately; retained imported samples stay in `UserData` until user deletes; OS permission revoke treated as disconnect. |
| **Deduplication** | Stable import IDs + timestamp windows; prefer user-confirmed manual over duplicate health sample when conflict policy says so; never double-count in daily totals. |
| **Logging restrictions** | **Forbidden** in logs/crash/metrics: sample values, quantity types beyond coarse “sync_ok/sync_fail”, and raw HealthKit/Health Connect payloads. |
| **Coaching boundary** | Wearable energy expenditure is **never** ground truth for `TransparentTrend v1`. |
| **Beta gate** | No health beta until purpose strings, privacy policy section, and M2-16 review complete. |

---

## Provider proxy

| Control | Requirement |
| --- | --- |
| Trust boundary | App talks only to **our** proxy for commercial / shared-key providers; OFF may be direct with fair-use if public and keyless |
| Secrets | Client secret / USDA production key / vendor keys in server secrets manager; rotated; never in EAS secrets that embed into the JS bundle |
| AuthN | Short-lived bearer from SecureStore session; optional App Attest / Play Integrity when mandatory decision flips on |
| AuthZ | Entitlement or free-tier allowance checked server-side before costly routes |
| Transport | TLS 1.2+; certificate-pinning **decision documented in M2-16** (pin vs public CA + backup pins) |
| Abuse | Rate limits, anomaly alerts, kill switches per provider adapter |
| Observability | Structured logs with request ID; redact Authorization, bodies, barcodes, search strings |

---

## Entitlement / billing assertions

- Source of truth: StoreKit 2 / Play Billing via entitlement service ([#14](./issue-14-freemium-matrix.md), [#23](https://github.com/NicholasTamm/Macro-tracker/issues/23)).
- Offline: short signed grace cache only; **never** hide or delete diary on entitlement error.
- Backend AI/vendor routes validate entitlement or signed allowance **before** accepting uploads.
- Do not send diary or health payloads to billing backends.

---

## Future AI photo / describe (pre-beta checklist)

| Requirement | Design |
| --- | --- |
| Explicit consent | Per-capture screen: what is sent, processor name, region, retention, training policy (default **no training** on user media), and that output is an estimate |
| EXIF removal | Strip GPS/EXIF client-side before upload; prefer cropped food region |
| Processor / region disclosure | Named subprocessor + primary processing region in UI and privacy policy |
| Editable output | Model returns a **draft plate**; user must confirm before diary write |
| Retention / deletion | Auto-delete originals on processor per disclosed TTL; user can delete associated drafts; support can trigger processor delete |
| Manual path | Always offer barcode / search / Quick Add / OCR without AI |
| Entitlement | Fair-use allowance per [#14](./issue-14-freemium-matrix.md); failed analysis does not consume quota |
| Beta gate | No production user traffic until M3-14 bake-off + counsel + this checklist signed |

---

## Sync (future — constrained by #19)

Until #19 selects a stack: no automatic multi-device sync. Any chosen design must provide stable IDs, tombstones, conflict policy, E2E or documented server encryption, account takeover recovery, and deletion that reaches all replicas. CloudKit is not default.

---

## Mapping to store / policy declarations

| Artifact | What this architecture feeds |
| --- | --- |
| **Privacy policy** | Data classes, purposes, subprocessors, retention, deletion, health scopes, AI consent, no sale of profiling data, contact for privacy |
| **Apple Privacy Manifest** | Required reason APIs actually used; declare File Timestamp / Disk Space / etc. only if linked; no tracking by default |
| **App Privacy (App Store Connect)** | Nutrition, health, photos (if AI), purchases, diagnostics — purposes and linked/not linked; tracking = false unless a future SDK changes that |
| **Google Play Data safety** | Same data types collected/shared; encryption in transit; deletion pathway; ephemerality for AI |
| **In-app** | About / Data Sources, privacy placeholder (M1-18) → full policy link before network/health/AI betas |

Exact checkbox matrices are filled at store-submission time from this document; do not invent collection that the app does not perform.

---

## Review gates (before betas)

| Beta type | Must be complete |
| --- | --- |
| **External network (M2 providers)** | This doc reviewed; proxy threat model; no secrets in binary (CI scan); logging scrub test; rate limits; M2-16 |
| **Health** | Granular consent copy; revocation tested; logging restrictions tested; privacy policy health section |
| **Sync** | #19 decision + encryption/deletion drill |
| **AI** | Consent/EXIF/region/editable/manual path; processor DPA; retention drill; entitlement enforcement |
| **Store external** | Privacy policy + Apple + Play questionnaires aligned; M3-17 counsel pass |

**Approval record:** This PR is the design submission. Nicholas (product) + counsel (privacy) + engineering security review must sign off before the first gated beta above. Implementation tasks remain in #13; do not treat merge of this doc as beta authorization.

---

## Milestone posture

| When | Privacy / security posture |
| --- | --- |
| **M1** | Local-only diary/weight; SecureStore reserved for future tokens; AsyncStorage prefs-only; privacy placeholder in Settings; camera-free privacy QA (M1-21) |
| **M2** | Provider proxy + health adapters behind reviews; M2-16 network/privacy/security review; no payload/health in logs |
| **M3** | IAP entitlements; AI bake-off flagged; privacy policy / store answers / deletion drills (M3-17); beta readiness (M3-19) |

---

## Bottom line

Macro-tracker treats nutrition, weight, health, provider, and AI data as **high-sensitivity by default**. Domain data lives in expo-sqlite; credentials live in **expo-secure-store**; **AsyncStorage never holds secrets**; commercial and shared USDA keys never ship in the Expo binary; health and AI features require explicit consent, scrubbed logs, and documented deletion before any external beta.
