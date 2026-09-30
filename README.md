# Macro-tracker

Original nutrition tracker (competitive-inspired only — no MacroFactor trademarks, assets, or private APIs).

## Product direction

The shipping client is **React Native / Expo**, not SwiftUI. The Expo reconciliation of the original investigation report is in [`docs/issue-11-investigation-report.md`](./docs/issue-11-investigation-report.md). It defines the stack-specific decisions that supersede Swift-era prescriptions in GitHub issue #11.

## Stack

**Product app:** Expo React Native under [`software/`](./software/).

Design tokens and components are ported from the interactive HTML library in the research workspace (`macrofactor-codex-research/design-system/`). See [`software/ROLLOUT-STATUS.md`](./software/ROLLOUT-STATUS.md) for Milestone 1 progress.

Food schema / seed contract (#12): [`docs/issue-12-food-schema-seed-contract.md`](./docs/issue-12-food-schema-seed-contract.md).

MVP backlog Milestones 1–3 (#13): [`docs/issue-13-mvp-backlog.md`](./docs/issue-13-mvp-backlog.md) · smoke `bash docs/demo/smoke-mvp-backlog.sh`.

Freemium matrix (#14): [`docs/issue-14-freemium-matrix.md`](./docs/issue-14-freemium-matrix.md) · smoke `bash docs/demo/smoke-freemium-matrix.sh`.

```bash
cd software
npm install
npx expo start
```

Open the **Component gallery** tab to review RN specimens against the HTML library.

Related: [Issue #11](https://github.com/NicholasTamm/Macro-tracker/issues/11).
