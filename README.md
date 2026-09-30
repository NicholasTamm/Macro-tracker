# Macro-tracker

Original nutrition tracker (competitive-inspired only — no MacroFactor trademarks, assets, or private APIs).

## Stack

**Product app:** Expo React Native under [`software/`](./software/).

Design tokens and components are ported from the interactive HTML library in the research workspace (`macrofactor-codex-research/design-system/`). See [`software/ROLLOUT-STATUS.md`](./software/ROLLOUT-STATUS.md) for Milestone 1 progress.

Food schema / seed contract (#12): [`docs/issue-12-food-schema-seed-contract.md`](./docs/issue-12-food-schema-seed-contract.md).

MVP backlog Milestones 1–3 (#13): [`docs/issue-13-mvp-backlog.md`](./docs/issue-13-mvp-backlog.md) · smoke `bash docs/demo/smoke-mvp-backlog.sh`.

```bash
cd software
npm install
npx expo start
```

Open the **Component gallery** tab to review RN specimens against the HTML library.
