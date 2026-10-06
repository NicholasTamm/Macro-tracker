# Docs demos

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
