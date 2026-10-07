# M1-21 — Accessibility / localization / privacy QA report

**Issue:** #66 · **Date:** 2026-10-06 PT · **Built by:** Grok (local) — gated for Codex/ChatGPT desktop review before merge  
**Checklist source:** [`issue-24-accessibility-localization.md`](./issue-24-accessibility-localization.md) (severity rubric: Critical / Major / Minor)  
**Automated gates:** `software/scripts/qa-m1-21.test.mjs` · **Demo:** `bash docs/demo/smoke-m1-21-qa.sh`

**Merged base:** `d33f79a` (including Settings #67 and Weight #69 from `origin/main` at `c04d756`) · **QA software tree:** `3530e5bb146ba52678091288eb1317a74e05d387` (also recorded with the tested HEAD in `out/issue-66-smoke-result.txt`)

Open critical findings: **0**

> Scope note: this pass audits the current post-merge QA tree. Settings (#67 / M1-18) and Weight (#69 / M1-17) are merged into the recorded base above, and the full smoke was completed again after those merges. Device-level checks (VoiceOver/TalkBack walkthroughs, max Dynamic Type, RTL on device) are listed under *Device QA still required* — static analysis cannot clear them.

## Surfaces covered

Onboarding (`app/onboarding/*`), Today (`app/(tabs)/today.tsx`), Search (`app/(tabs)/food-entry.tsx`), Food detail (`FoodDetailSheet`), diary edit (`DiaryEntryEditSheet`), custom food (`CustomFoodEditorSheet`), Settings (main placeholder + PR #67 screens), Weight (PR #69, Analytics tab), design-system components.

## Findings

| ID | Area | Finding | Severity | Status |
| --- | --- | --- | --- | --- |
| QA-01 | Contrast | Light `muted` #777777 was 4.25:1 on canvas, 3.96 on band, 3.79 on control (< 4.5 AA) — used for captions, helper text, tab bar inactive labels | **Critical** (TC-03) | **Fixed** → #6b6b6b (≥4.51 on all surfaces) |
| QA-02 | Contrast | Light `danger` #df4c4c was 3.37:1 on control — Delete button / inline errors are text | **Critical** (TC-03) | **Fixed** → #b83232 (≥5.02) |
| QA-03 | Contrast | Dark `muted` #9a9a9a 4.17:1 on dark control; dark `danger` inherited light value (2.95:1 on control) | **Critical** (TC-03) | **Fixed** → muted #a8a8a8 (≥4.93), dark-only danger #ff8080 (≥4.83) |
| QA-04 | Reduce Motion | All three modal sheets forced `animationType="slide"` regardless of OS setting | Major (motion) | **Fixed** — `useReduceMotion()` + `modalAnimationFor()` → `none` when Reduce Motion / Remove animations is on |
| QA-05 | RTL | `MacroSummary` used `borderRightWidth/Color` (separator on wrong side in RTL); Settings placeholder used `marginLeft` | Major (RTL mirror) | **Fixed** → `borderEnd*`, `marginStart` |
| QA-06 | Privacy | No camera/mic/location permissions declared, but Expo/autolinked libs can add Android permissions transitively | Minor (defence in depth) | **Fixed** — `android.blockedPermissions` for CAMERA, RECORD_AUDIO, ACCESS_{FINE,COARSE,BACKGROUND}_LOCATION + test |
| QA-07 | Screen reader | Every `Pressable` / `TextInput` / `Switch` across app, components, design-system, modules has an `accessibilityLabel` and (pressables) `accessibilityRole`; selection chips/choices expose `accessibilityState.selected` | — | Pass (gated by test) |
| QA-08 | Screen reader | Weight chart (PR #69) is a single `accessibilityRole="image"` whose label is the textual summary (VO-07 / TB-05); MacroSummary exposes an aggregate label | — | Pass |
| QA-09 | Typography | `Typography.micro` (9pt) still exists; not used for essential info on audited surfaces | Minor | Tracked (Dynamic Type helper is post-M1) |
| QA-10 | ErrorBanner | Tint backgrounds are hard-coded `rgba(...)` from old token values; text uses `ink`, so contrast holds | Minor | Tracked |
| QA-11 | Localization | Strings are English literals; no i18n catalog yet. Numbers/dates use `toLocaleDateString` / fixed-decimal formatting | Minor (pre-catalog) | Tracked — catalog is M2 |
| QA-12 | Contrast | Gallery's 11pt “DESIGN SYSTEM” caption used light `brand` at 2.21:1 on canvas | **Critical** (TC-03) | **Fixed** → `ink`; gate now covers every token used as a text foreground |
| QA-13 | Contrast | Inputs, unselected choices, and secondary buttons used decorative `divider` for their control boundary (< 3:1) | Major (TC-04) | **Fixed** → dedicated `controlBorder` token, gated on canvas and raised surfaces |
| QA-14 | Contrast | ErrorBanner message text used `muted` on education and translucent tint backgrounds (< 4.5:1) | **Critical** (TC-03) | **Fixed** → banner foreground (`ink` / `educationInk`); translucent backgrounds are composited before contrast is gated |
| QA-15 | RTL | Settings used a hard-coded right chevron, so the glyph did not mirror in RTL | Major (RTL mirror) | **Fixed** → direction-aware left/right chevron; hard-coded directional icon names are gated |

## Contrast (WCAG AA, text 4.5:1)

Computed with WCAG 2.x relative luminance (`contrast()` in the QA test).

| Scheme | Text token | on canvas | on band | on raised | on control |
| --- | --- | --- | --- | --- | --- |
| Light | `ink` #080808 | 19.02 | 17.73 | 20.03 | 16.95 |
| Light | `muted` #6b6b6b | 5.06 | 4.72 | 5.33 | 4.51 |
| Light | `danger` #b83232 | 5.63 | 5.25 | 5.93 | 5.02 |
| Dark | `ink` #f6f6f3 | 17.01 | 15.22 | 14.16 | 10.83 |
| Dark | `muted` #a8a8a8 | 7.75 | 6.93 | 6.45 | 4.93 |
| Dark | `danger` #ff8080 | 7.59 | 6.79 | 6.31 | 4.83 |

Also gated: primary/selected-control text (`raised` on `ink`) ≥4.5; education text (`educationInk` on `education`) ≥4.5; `ink` on every translucent ErrorBanner tint after compositing it over the canvas; weight chart dots (`weightTrend` on `band`) ≥3:1 non-text; and control boundaries (`controlBorder` on `canvas` and `raised`) ≥3:1 in both schemes. Light `controlBorder` is #8a8a8a (3.28:1 on canvas, 3.45:1 on raised); dark is #777777 (4.11:1 on canvas, 3.42:1 on raised).

Design note: the token changes are a11y overrides of the HTML design-system values (`--app-muted`, `--app-danger`); the HTML library should be updated to match.

## Reduce Motion

- `design-system/theme/useReduceMotion.ts` subscribes to `AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged`.
- Food detail, diary edit and custom food sheets use `modalAnimationFor(reduceMotion)` (`none` when on, `slide` otherwise).
- No `Animated` / Reanimated / `LayoutAnimation` usage in app code; the QA test fails if one is added without a Reduce Motion gate.
- Manual smoke (device): iOS Settings → Accessibility → Motion → Reduce Motion ON; Android Developer options → Remove animations. Open Search → food → detail sheet: appears without slide. *(Recorded as required device step.)*

## RTL smoke

- Static: no `marginLeft/Right`, `paddingLeft/Right`, `left/right`, `border{Left,Right}*` in any `.tsx` (gated). Rows use `flexDirection: 'row'`, which RN mirrors under RTL; directional icon names and rendered Unicode text glyphs cannot be hard-coded. Settings selects its chevron and Today selects its previous/next glyphs with `I18nManager.isRTL`.
- Weight chart dots use `start:` so the time axis mirrors along with its captions.
- Manual smoke (device / web): `I18nManager.forceRTL(true)` + reload, or Android "Force RTL layout direction"; check Today meal cards, MacroSummary separators, Search rows, sheets, Settings rows, Weight rows. *(Required device step.)*

## Privacy (camera-free, local-only)

- `app.json`: no `ios.infoPlist` usage strings, no `android.permissions`, no camera/mic/location plugins; `android.blockedPermissions` strips CAMERA / RECORD_AUDIO / location even if a dependency requests them.
- `package.json`: no camera, audio, location, image-picker, barcode-scanner, tracking or analytics SDKs (gated).
- Network: the only runtime `fetch` is `FoodCatalogProvider` reading the **bundled** FoodSeed asset URI; `build-seed` downloads are dev-time scripts. No user data leaves the device in M1; export (M1-19) is user-initiated share sheet only.

## Screen reader

Static gate covers labels/roles for every interactive control. Patterns verified: PrimaryButton (role button, label, disabled state), FoodRow action, ErrorBanner `alert` role + labeled dismiss, ChoiceRow/selection chips with `selected` state, sheets with `accessibilityViewIsModal`, Weight per-row "Edit/Delete <weight> on <date>" labels and live-region status.

## Post-merge cross-check

Settings PR #67 and Weight PR #69 are present in `origin/main` at `c04d756` and were merged into this branch at `d33f79a`. The smoke script refuses dirty changes under `software/`, `docs/demo/`, or this report. The regenerated `out/issue-66-smoke-result.txt` records both the tested HEAD and the immutable `git rev-parse HEAD:software` tree hash, so the tested software contents can be verified independently of the later evidence-only commit.

## Device QA still required (not clearable by static analysis)

VO-01/TB-01 focus order, VO-09 sheet focus return, DT-01/02/03 max text size reflow, TC-06 colour-blind simulation, Reduce Motion + RTL on device as above. None are known-failing; they must be executed before external beta per #24.
