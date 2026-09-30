# Macro-tracker

Original nutrition tracker (competitive-inspired only — no MacroFactor trademarks, assets, or private APIs).

## Product direction

The shipping client is **React Native / Expo**, not SwiftUI. The Expo reconciliation of the original investigation report is in [`docs/issue-11-investigation-report.md`](./docs/issue-11-investigation-report.md). It defines the stack-specific decisions that supersede Swift-era prescriptions in GitHub issue #11.

## Stack

**Product app:** Expo React Native under [`software/`](./software/).

```bash
cd software
npm install
npx expo start
```

## Preview this docs PR

```bash
# From the repo root (this branch):
less docs/issue-11-investigation-report.md
# or open in an editor / markdown preview:
#   code docs/issue-11-investigation-report.md
#   glow docs/issue-11-investigation-report.md   # if glow is installed
```

Related: [Issue #11](https://github.com/NicholasTamm/Macro-tracker/issues/11).
