# Docs demos

## Issue #71 — M1-22 Theme/diary integrity

Validates that repeated system/light/dark saves, provider refreshes, Today reloads,
and sql.js persistence do not create, duplicate, restore, delete, or mutate diary
rows. Also verifies idempotent replay of one banana log intent.
The production web smoke saves dark theme through the settings UI, revisits
Today, and reloads the browser while preserving that single banana row.

```bash
# from repo root
bash docs/demo/smoke-m1-issue-71.sh
```

Writes `out/issue-71-smoke-result.txt` on success.

## Issue #72 — Expo web WASM startup

Clean-installs dependencies, verifies the generated sql.js browser WASM, runs
typecheck and tests, then starts Expo web and checks the document, entry/worker
bundles, isolation headers, and both SQLite WASM resources over HTTP.

```bash
# from repo root
bash docs/demo/smoke-m1-issue-72.sh
```

Writes `out/issue-72-smoke-result.txt` on success.

## Issue #63 — Settings smoke

Validates persisted display units and theme, profile editing, USDA attribution, licenses, privacy placeholder, routes, typecheck, and tests.

```bash
# from repo root
bash docs/demo/smoke-m1-18-settings.sh
```

Writes `out/issue-63-smoke-result.txt` on success.

## Issue #13 — MVP backlog smoke

Validates the Expo-reconciled backlog markdown (headings, task IDs, supersession keywords).

```bash
# from repo root
bash docs/demo/smoke-mvp-backlog.sh
```

Writes `out/issue-13-smoke-result.txt` on success/failure.

## Issue #14 — Freemium matrix smoke

Validates the Expo-reconciled freemium matrix (structure, supersession keywords, free/premium rows, entitlements, policy guards).

```bash
# from repo root
bash docs/demo/smoke-freemium-matrix.sh
```

Writes `out/issue-14-smoke-result.txt` on success/failure.

## Issue #15 — Source verification log smoke

Validates the Expo-reconciled primary-source verification log (headings, Expo keywords, status keys, source URLs, policy guards).

```bash
# from repo root
bash docs/demo/smoke-source-log.sh
```

Writes `out/issue-15-smoke-result.txt` on success/failure.

## Issue #19 — Sync architecture smoke

Validates the Expo-reconciled sync architecture ADR (headings, options, conflict keywords, CloudKit-not-SoR guard).

```bash
# from repo root
bash docs/demo/smoke-sync-arch.sh
```

Writes `out/issue-19-smoke-result.txt` on success/failure.

## Issue #22 — Privacy / security smoke

Validates the Expo-reconciled privacy/security architecture (headings, SecureStore/AsyncStorage rules, mitigations, health/AI/provider controls, store-declaration maps).

```bash
# from repo root
bash docs/demo/smoke-privacy-security.sh
```

Writes `out/issue-22-smoke-result.txt` on success/failure.

## Issue #23 — Billing / store operations smoke

Validates the Expo-reconciled billing/store ops contract (headings, StoreKit+Play mapping, entitlement IDs, lifecycle coverage, no hard-coded price policy).

```bash
# from repo root
bash docs/demo/smoke-billing-store.sh
```

Writes `out/issue-23-smoke-result.txt` on success/failure.

## Issue #24 — Accessibility / localization smoke

Validates the Expo-reconciled a11y/l10n audit checklist (VoiceOver/TalkBack, Dynamic Type, Reduce Motion, themes, locales/RTL, nutrient-not-color-alone, severity/gates).

```bash
# from repo root
bash docs/demo/smoke-a11y-l10n.sh
```

Writes `out/issue-24-smoke-result.txt` on success/failure.

## Issue #64 — M1-17 Weight samples + 30-day chart

Weight create/edit/soft-delete on `weight_sample` (canonical kg, entry in profile kg/lb), 30-day View-based chart (no chart deps) with an accessible text summary (count/latest/min/max/change), empty + sparse copy. Screen: Analytics tab.

```bash
# from repo root
bash docs/demo/smoke-m1-17-weight.sh
```

Writes `out/issue-64-smoke-result.txt` on success.

## Issue #65 — Seed update client smoke

Validates the disabled-by-default seed updater, signed-manifest tests, atomic
rollback behavior, typecheck, and the complete serialized test suite.

```bash
# from repo root
bash docs/demo/smoke-m1-20-seed-update.sh
```

Writes `out/issue-65-smoke-result.txt` on success.

## Issue #66 — M1-21 Accessibility / localization / privacy QA

Static QA gates (token contrast WCAG AA light/dark, no camera/mic/location permissions or analytics deps, no remote network, RTL start/end, Reduce Motion modals, labels/roles on every control) + report `docs/m1-21-a11y-l10n-privacy-qa.md`.

```bash
# from repo root
bash docs/demo/smoke-m1-21-qa.sh
```

Writes `out/issue-66-smoke-result.txt` on success.
