# Docs demos

## Issue #78 — M1-29 Web export download fallback

Runs typecheck, focused export/share tests, the full suite, then a headless Chrome
harness that triggers `exportFilesViaWeb` and validates downloaded JSON + CSV.

```bash
# from repo root
bash docs/demo/smoke-m1-issue-78.sh
```

Writes `out/issue-78-smoke-result.txt` on success.

## Issue #71 — M1-22 Theme/diary integrity

Validates that repeated system/light/dark saves, provider refreshes, Today reloads,
and sql.js persistence do not create, duplicate, restore, delete, or mutate diary
rows. Also verifies idempotent replay of food-detail and quick-add intents.
(Production Expo web UI smoke is deferred until #73 absolute sql.js WASM URL lands.)

```bash
# from repo root
bash docs/demo/smoke-m1-issue-71.sh
```

Writes `out/issue-71-smoke-result.txt` on success.

## Issue #73 — sql.js WASM on direct web routes

Runs focused and full tests, then uses headless Chrome network logs to verify
root, direct settings routes, and a profile refresh request the stable sql.js
WASM URL without a route-relative request or failure UI.

```bash
# from repo root
bash docs/demo/smoke-m1-issue-73.sh
```

Writes `out/issue-73-smoke-result.txt` on success.

## Issue #74 — M1-25 Settings navigation and choice accessibility

Validates 44×44 destination-labelled stack back controls, radio-group/checked semantics, keyboard focus treatment, typecheck, and the full serialized test suite. Manual VoiceOver, TalkBack, and browser keyboard steps are recorded in `docs/m1-25-settings-choice-a11y-qa.md`.

```bash
# from repo root
bash docs/demo/smoke-m1-issue-74.sh
```

Writes `out/issue-74-smoke-result.txt` on success.

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

## Issue #80 — M1-31 Semantic color tokens

Expands surface/state/overlay/chart tokens, removes ErrorBanner raw fills, keeps
data-domain colors theme-stable, reserves danger for errors only, and syncs
StatusBar / SystemUI chrome with the active palette.

```bash
# from repo root
bash docs/demo/smoke-m1-issue-80.sh
```

Writes `out/issue-80-smoke-result.txt` on success.


## Issue #119 — M1-61 Gentle companion illustration tokens

```bash
bash docs/demo/smoke-m1-issue-119.sh
```

Checks the illustration tokens, the `brand` button variant, gallery specimens, and that the data zone has no illustration tokens; then runs typecheck, lint and the full test suite. Writes `out/issue-119-smoke-result.txt` on success.

## Issue #120 — M1-63 Figtree + Nunito fonts

```bash
bash docs/demo/smoke-m1-issue-120.sh
```

Checks no MacroFactor font ships, runs typecheck, lint, the font tests and the full suite, then exports the web build and asserts exactly six faces are bundled (Figtree 400/500/600/700, Nunito 700/800). Writes `out/issue-120-smoke-result.txt`.

## Issue #121 — M1-62 Fluent food icons

Run `bash docs/demo/smoke-m1-issue-121.sh`. It checks that ≥30 Microsoft Fluent Emoji Flat SVGs and their MIT licence are in `software/assets/food-icons/`, then runs typecheck, lint, the keyword-mapping tests (`modules/food-catalog/foodIcon.test.mjs`) and the full suite. It also does a web export and confirms the SVGs are bundled. Result: `out/issue-121-smoke-result.txt`.

Manual check: open Food entry and search "banana", then open Today. Each row shows a flat food icon (32 px in search results, 24 px in diary rows) in place of the system emoji. Unknown foods show the bowl. Screen readers skip the icon.

## Issue #122 — M1-64 Placeholder mascot and EmptyState slot

Run `bash docs/demo/smoke-m1-issue-122.sh`. It checks that the six placeholder poses are in `software/assets/mascot/`, then runs typecheck, lint, `scripts/issue-122-mascot.test.mjs` and the full suite. It also does a web export and confirms every pose is bundled. Result: `out/issue-122-smoke-result.txt`.

Manual check: open the component gallery and toggle light/dark. "Mascot (placeholder art)" shows wave, think, cheer, sleep, scale and emptyPlate, followed by an empty state with the mascot and a brand CTA. The placeholder is hand-written SVG circles. Final art from #127 replaces the files with the same names and needs no code change.

## Issue #123 — M1-65 Mascot empty states

Run `bash docs/demo/smoke-m1-issue-123.sh`. It runs typecheck, lint, the empty-state and mascot tests, and the full suite. It also does a web export and confirms the emptyPlate and think art, the new copy, and the `/food-entry` route are bundled. Result: `out/issue-123-smoke-result.txt`.

Manual check:
1. On a fresh profile, open Today. The emptyPlate mascot shows with "Nothing on your plate yet" and a brand "Log food" button.
2. Tap "Log food". It opens Food entry, which shows the think mascot above "Search USDA staples".
3. Log one food and return to Today. The mascot is gone.

Slot cards and the macro summary never show art. A search with no matches stays plain.

## Issue #124 — M1-66 No-weigh-ins mascot

Run `bash docs/demo/smoke-m1-issue-124.sh`. Result: `out/issue-124-smoke-result.txt`.

Manual check:
1. With no weights logged, open Analytics. "Last 30 days" shows the scale mascot above "No weights yet".
2. Log one weight. The mascot is replaced by the chart.
3. If every weight is older than 30 days, the "No recent weights" state shows no art.

## Issue #125 — M1-67 Goal-hit celebration

The rule was approved by the owner on Oct 28: calories within ±10% of the calorie goal and protein at or above 90% of the protein goal. Both goals must exist.

Run `bash docs/demo/smoke-m1-issue-125.sh`. It runs typecheck, lint, `modules/diary/goalHit.test.mjs` and the full suite. Then `scripts/smoke-issue-125.mjs` uses a real sql.js store to log food up to the target, reload from the exported bytes, and confirm that the card condition holds and that `goal_hit_celebrated_day` is claimed exactly once. A web export confirms the card copy and the cheer art are bundled. Result: `out/issue-125-smoke-result.txt`.

Manual check on a device:
1. Log food to the target. A compact card with the cheer mascot appears above the meal slots, and one success haptic fires.
2. Reload. The card stays and there is no second haptic.
3. Delete or undo so you drop below the target. The card hides.
4. Past days never celebrate.
5. With Reduce Motion on, the card appears without animation.

## Issue #126 — M1-68 Onboarding mascot

Run `bash docs/demo/smoke-m1-issue-126.sh`. It runs typecheck, lint, the onboarding-mascot and contrast (qa-m1-21) tests, and the full suite. It also does a web export and confirms the wave and cheer art are bundled. Result: `out/issue-126-smoke-result.txt`.

Manual check on a fresh profile:
1. The first step ("Confirm you are an adult") shows the wave mascot above a Nunito display title.
2. Middle steps are plain.
3. "Starter target" shows the cheer mascot.
4. Every primary CTA is brand orange with a dark label. When disabled, it shows a muted label on the control grey, not a faded orange.
