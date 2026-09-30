# Issue #19 — Cross-platform sync architecture and conflict policy (Expo ADR)

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-sync-arch.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/` (iOS + Android).  
**Source issue:** [NicholasTamm/Macro-tracker #19](https://github.com/NicholasTamm/Macro-tracker/issues/19)  
**Research OUT (Swift-era sync prescription, superseded):** `/workspace/macrofactor-codex-research/OUT/investigation-report.md` §D3 (SwiftData + private CloudKit)

## Supersession notice

SwiftData + private CloudKit as the default multi-device system of record in the research OUT and any Apple-only sync wording in related issues are **superseded**. Macro-tracker ships Expo on **iOS and Android**. CloudKit cannot be the system of record.

| Research prescription | Expo / RN decision |
| --- | --- |
| SwiftData + private CloudKit for user data (M2) | **No sync in M1.** M2+ sync must be cross-platform; CloudKit is **not** the default SoR |
| CloudKit container / iCloud account as identity | Optional future Apple convenience only; never required for Android or for free diary use |
| Unique constraints not enforced → app UUIDs | Keep: all user entities use app-generated stable UUID strings (#12) |
| Catalog never synced via CloudKit | Keep: `FoodSeed.sqlite` and license-restricted provider caches **never** enter user sync |
| M1 local-only + repository abstraction | Keep: local `UserData.sqlite` (expo-sqlite) + repository ports so a sync adapter can plug in later |

**Pointers**

- Food schema / user-store boundary (#12): [`docs/issue-12-food-schema-seed-contract.md`](./issue-12-food-schema-seed-contract.md)
- MVP backlog M2-11 / M2-12 (#13): [`docs/issue-13-mvp-backlog.md`](./issue-13-mvp-backlog.md) (PR may still be open)
- Freemium: sync as premium convenience (#14): [`docs/issue-14-freemium-matrix.md`](./issue-14-freemium-matrix.md) (PR may still be open)
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)

**Hard exclusions:** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering. No ads or sale of nutrition/health profiling data.

---

## Decision summary (ADR)

| Decision | Choice |
| --- | --- |
| **M1 default** | **Local-only.** `UserData.sqlite` via expo-sqlite; no account; no network required. Free CSV/JSON export + restore is the backup path. |
| **CloudKit as SoR** | **Rejected.** Apple-only; incompatible with Android as a first-class client. |
| **M2+ preferred direction** | **Offline-first SQLite sync** of the **user store only**, with a **Postgres** cloud system of record (candidate: **PowerSync + Supabase/Postgres**, or equivalent). Automatic multi-device sync is a **premium** convenience when it ships ([#14](./issue-14-freemium-matrix.md)). |
| **Fallback / forever-free path** | Manual export / import / restore remains available and ungated even if sync never ships or a provider is exited. |
| **What syncs** | User-owned rows only: diary, custom foods/recipes, favorites/recents, weights, profile/goals/coaching outputs when those tables exist. |
| **What never syncs** | `FoodSeed.sqlite`; OFF/FDC/FatSecret (etc.) remote cache payloads; secrets; entitlement receipts beyond what the entitlement service already stores. |

This ADR records direction **before** M2-11/M2-12 implementation. Provider lock-in of a specific SaaS SKU is deferred to an M2 spike; the **shape** (local SQLite + Postgres SoR + explicit conflict/tombstone policy + catalog exclusion) is binding.

---

## 1. Goals and non-goals

### Goals

- Preserve Expo **iOS + Android** parity for any automatic sync.
- Keep M1 shippable offline with zero account friction.
- Make sync additive: repository ports, stable IDs, tombstones, and schema versioning land in the user store **before** a network adapter.
- Protect user ownership: export, restore, account deletion, and provider exit must work without premium.
- Keep curated catalog and restricted provider caches out of the sync plane.

### Non-goals (this ADR)

- Implementing M2-11/M2-12 sync code.
- Choosing final SaaS contracts, pricing tiers, or HIPAA/BAA paperwork (flag for counsel).
- Making CloudKit a peer SoR for Android.
- Syncing HealthKit / Health Connect raw samples as the diary SoR (health adapters remain separate; see health-sync module).

---

## 2. Option comparison (cross-platform)

Evaluation axes: Expo iOS+Android fit, offline-first, auth, encryption, residency/control, ops cost, deletion/exit, conflict control, fit with `UserData.sqlite`.

| Option | Expo iOS+Android | Offline / local SQLite | Auth model | Encryption / residency | Ops cost (order-of-magnitude) | Account deletion / exit | Conflict control | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A. No-sync / manual backup** | Perfect | Native `UserData.sqlite` | None | Device storage; user holds export files | ~$0 beyond app hosting | Delete local DB + exported copies under user control | N/A (single device) | **M1 default.** Always retain as free escape hatch. |
| **B. PowerSync + Postgres (e.g. Supabase)** | Strong (RN/Expo SDK; native SQLite adapters for prod builds) | Local SQLite reads/writes; upload queue; stream-down | Email/OAuth/Apple/Google via host auth (e.g. Supabase Auth) | TLS in transit; provider disk encryption; choose region; app-level field encryption optional | Sync service + Postgres free tiers then usage; expect low tens–hundreds USD/mo early | Cascade delete user rows + auth identity; documented export before wipe | App-defined LWW + tombstones; server can enforce RLS per `user_id` | **Preferred M2+ candidate.** Matches offline-first diary; keeps Postgres as explicit SoR. |
| **C. Custom REST/GraphQL sync over Postgres** | Strong (fetch + expo-sqlite) | DIY outbox / pull | Same as host auth | Full control of schema and region | Engineering time dominant; infra similar to B without sync SaaS | Full control | Full control — highest test burden | **Viable fallback** if PowerSync (or peer) cost/terms fail. Same conflict policy applies. |
| **D. Firebase Firestore (+ local cache)** | Strong | Cache/persistence; not our `UserData.sqlite` schema as SoR | Firebase Auth | Google regions; limited residency knobs | Spark/Blaze; can spike with fan-out | Auth delete + recursive data delete APIs | Last-write / security rules; harder to keep SQLite-shaped diary | **Not preferred** as SoR: pulls away from expo-sqlite contract (#12) and complicates offline replay tests. |
| **E. WatermelonDB / RxDB sync engines** | Possible | Local DB with sync protocol to a backend | Depends on backend | Depends on backend | Engineering + backend | Depends on backend | Built-in strategies vary | **Optional client library** later; still needs a Postgres (or similar) SoR and our conflict policy. Not chosen as the architecture itself. |
| **F. ElectricSQL / similar sync-over-Postgres** | Evolving; verify Expo maturity at spike time | Local SQLite shapes | Host auth | Postgres-centric | Similar to B | Similar to B | Depends on product maturity | **Watch-list peer** to PowerSync; evaluate in M2 spike on Expo maturity and ops. |
| **G. CloudKit (private DB) as SoR** | **iOS only** | Opaque; not Android | Apple ID | Apple residency | Low cash / high platform lock | Apple account / CK APIs | Opaque; unique constraints weak | **Rejected as SoR.** May never be more than an optional iOS export convenience — not default sync. |

### Authentication requirements (when sync exists)

- Sync is **opt-in** and account-backed; M1 and free single-device use need **no** account.
- Support at least one low-friction mobile path (Sign in with Apple on iOS; Google or email magic-link on Android) behind a single app identity (`user_id`).
- Tokens live in secure storage; refresh handled by the auth SDK; sync connector supplies short-lived credentials only.
- Signing out disables sync and leaves local data intact until the user chooses delete or restore-from-export.

### Encryption requirements

- TLS 1.2+ for all sync traffic.
- Provider disk encryption at rest for Postgres and object backups.
- Prefer a single declared cloud region (document in privacy policy); no silent multi-region copy of diary payloads.
- Optional later: client-side encryption of highly sensitive columns (e.g. free-text notes) with a key derived from user secret — **not** required for M1; if added, export must still be decryptable by the user.
- Never log nutrient diary payloads or auth tokens in analytics.

### Data residency and operating cost

- Record the chosen region and subprocessors in privacy/About before enabling sync in a store build.
- Budget assumption for early M2: design so a small user base fits a managed Postgres + sync free/pro tier; gate automatic sync behind premium ([#14](./issue-14-freemium-matrix.md)) so COGS track revenue.
- AI/vendor proxy backends (FatSecret, etc.) are **orthogonal** to diary sync SoR; they must not become an accidental second diary database.

### Account-deletion requirements

- In-app **Delete account & synced data** (and local wipe option) — never paywalled.
- Server: delete auth identity, all user-scoped sync rows, and backups within a documented retention window; confirm with email/receipt when an account existed.
- Local: wipe `UserData.sqlite` user tables (or file) after confirmation; preserve read-only `FoodSeed.sqlite`.
- Export must be offered **before** destructive delete when an account exists.

---

## 3. Sync plane vs non-sync plane

| Store / data | Sync? | Notes |
| --- | --- | --- |
| `UserData.sqlite` diary entries + nutrient snapshots | Yes (M2+) | Snapshots stay immutable per entry revision |
| Custom foods / recipes / favorites / recents / weights / profile / goals / coaching outputs | Yes (M2+) | When tables exist per #12 / #13 |
| `FoodSeed.sqlite` | **Never** | CDN/artifact replacement only |
| Remote provider cache (OFF, FDC Branded, FatSecret IDs, etc.) | **Never** by default | Device-local TTL; license/ToS may forbid durable multi-device copies |
| Entitlement / StoreKit / Play Billing artifacts | Via entitlement service only | Not part of diary sync documents |
| HealthKit / Health Connect raw samples | Not via diary sync | Re-import through health adapters; do not fork a second weight history without dedupe rules |

---

## 4. Identifiers, tombstones, conflict policy

### Stable IDs

- Every synced user entity has an application-generated **UUID string** primary key (see #12). Do not rely on autoincrement or provider-native IDs as the merge key.
- `food_id` for catalog rows remains `<source>:<external-id>` and is **referenced** from diary snapshots, not re-synced as catalog rows.
- Custom user foods use UUIDs in the user store; snapshots embed nutrient values so catalog churn cannot mutate history.

### Revisions and clocks

- Each synced row carries:
  - `updatedAt` — ISO-8601 UTC timestamp set on local write
  - `revision` — monotonic integer per entity id (increment on every local mutating write)
  - `deletedAt` — null or ISO-8601 UTC tombstone timestamp
- Device clock skew: on sync connect, record server time offset; prefer `revision` + server `updatedAt` for LWW when skew is detected.

### Tombstones

- Soft-delete only for synced entities: set `deletedAt`, keep row until compaction.
- Sync must propagate tombstones so a delete on device A removes/hides the row on device B.
- Compaction: hard-delete tombstones older than a documented window (e.g. 90 days) **after** all known devices have acknowledged, or on account deletion.

### Conflict resolution (binding policy)

| Scenario | Resolution |
| --- | --- |
| Two devices edit different entities | Independent merge; no conflict |
| Two devices edit same entity, different fields | **Last-writer-wins on the whole row** for MVP (simpler, testable). Optional later: field-level merge for profile prefs only |
| Two devices edit same entity; loser has lower `revision` / older write | Keep winner row; discard loser body; optional `sync_conflict` debug event (no user-blocking modal in MVP) |
| Delete vs update | **Tombstone wins** if `deletedAt` is set on either side and delete `revision` is not strictly dominated by a newer undelete policy — MVP does **not** support undelete via sync; restore from export instead |
| Offline create on two devices with distinct UUIDs | Both kept (not a conflict) |
| Offline replay of the same mutation twice | Idempotent upsert by primary key; `revision` does not double-apply |
| Duplicate diary appearance after replay | **Bug.** Repair: upsert-by-id; unique index on entity id; integration test M2-12 |

### Offline replay

- Local writes always succeed against `UserData.sqlite` without network.
- An outbox (PowerSync upload queue or custom outbox table) records mutations in order.
- On reconnect: push outbox, pull remote changes, apply idempotent upserts/tombstones, then run duplicate-repair check (count by id).
- Partial failure: retry with backoff; never wipe local diary on sync error; surface `OfflinePill` / sync status in Settings.

### Duplicate repair

- Hard unique constraint on primary key in SQLite and Postgres.
- Startup / post-sync job: if any id appears duplicated in a denormalized projection, keep highest `revision` and tombstone extras.
- Diary totals always aggregate by surviving non-deleted ids.

### Schema migration behavior

- User store migrations are **forward-only**, versioned (e.g. `user_store_schema_version`).
- Additive columns preferred; renames via add + backfill + deprecate.
- Sync schema (Postgres / sync rules) must accept older clients for a documented window: new columns optional; required new columns need a min-app-version gate.
- Seed catalog migrations replace `FoodSeed.sqlite` artifacts independently and never go through the user sync channel.
- A device on a too-old app version may read-only sync or pause push until updated — never silently drop user rows.

---

## 5. Export, restore, DR, provider exit

| Path | Behavior |
| --- | --- |
| **Export (free)** | Complete CSV/JSON of user-owned data + provenance; works offline; no premium (#14). |
| **Restore** | Import replaces or merges into local `UserData.sqlite` with explicit user choice (replace vs merge-by-id); preview counts before commit. |
| **Disaster recovery** | Local export is primary DR in M1. With sync: Postgres point-in-time backup + user export; document RPO/RTO targets at M2 spike. |
| **Provider exit** | Keep export format stable; document a one-shot “download all synced data”; ability to stand up custom REST sync (option C) against a Postgres dump without rewriting diary UI. |
| **Sync off** | User can disable sync; local DB remains; remote copy retained until account deletion per retention policy. |

---

## 6. Milestone mapping

| Milestone | Sync posture |
| --- | --- |
| **M1** | **Local-only default.** Stable UUIDs, `revision`/`deletedAt` columns, repository ports, CSV/JSON export. No account. |
| **M2** | Spike PowerSync+Postgres (or peer); implement M2-11 configuration for **user store only**; M2-12 conflict/tombstone/duplicate/account-off suite. Catalog/cache excluded. |
| **M3+** | Premium gate for automatic sync if COGS require it; entitlement service remains separate. |

---

## 7. Acceptance checklist (maps to #19)

| Criterion | Where satisfied |
| --- | --- |
| Compare cross-platform providers + no-sync/manual-backup | §2 table (A–G) |
| Auth, encryption, residency, cost, account deletion | §2 subsections |
| Stable IDs, tombstones, conflicts, offline replay, duplicate repair, schema migration | §4 |
| FoodSeed + license-restricted caches out of sync | §3 |
| Export, restore, DR, provider exit | §5 |
| Chosen direction before M2 implementation | Decision summary + §6 |
| No CloudKit-as-SoR; M1 local-only | Supersession + Decision summary |

---

## Bottom line

**M1 ships local-only** with expo-sqlite `UserData.sqlite` and free export/restore. **Automatic sync, when built, is cross-platform offline-first SQLite ↔ Postgres** (PowerSync+Supabase as the leading candidate), never CloudKit-as-SoR. Conflict policy is stable UUIDs, row revisions, tombstones-win deletes, last-writer-wins updates, idempotent offline replay, and strict exclusion of catalog/provider-cache bytes from the sync plane.
