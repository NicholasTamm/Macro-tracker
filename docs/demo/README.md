# Docs demos

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
