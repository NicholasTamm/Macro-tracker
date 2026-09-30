# Issue #24 — Accessibility, localization, and inclusive release audit

**Reconciled:** 2026-09-29 PT  
**Status:** Submitted as a GitHub PR for review; not merged. Awaiting Nicholas approval — do not merge without explicit approval. Demo smoke: `docs/demo/smoke-a11y-l10n.sh`.  
**Shipping stack:** Expo + React Native + TypeScript under `software/`.  
**Source issue:** [NicholasTamm/Macro-tracker #24](https://github.com/NicholasTamm/Macro-tracker/issues/24)  
**Release-gate lineage:** External QA gate from [#11](https://github.com/NicholasTamm/Macro-tracker/issues/11). Engineering tasks live in [#13](./issue-13-mvp-backlog.md) (esp. **M1-21**, M2-19, M3-11, M3-19). This issue owns the **cross-feature a11y / l10n audit checklist and evidence record** before external beta — not feature code.  
**Not a substitute for device QA.** Checklists below must be executed on physical (or high-fidelity) iOS + Android builds; markdown alone does not clear critical defects.

## Supersession notice

SwiftUI / UIKit-only accessibility prescriptions from research OUT and early #11 notes are **superseded** for Macro-tracker implementation. Product requirements remain binding: screen-reader labels and focus order, Dynamic Type / font scaling, light/dark themes, Reduce Motion, 44×44 effective touch targets, contrast, color-blind differentiation (nutrients not by color alone), RTL / locale-safe formatting, and zero **critical** a11y or l10n defects before external beta.

| Research-era prescription | Expo / RN decision |
| --- | --- |
| UIKit `UIAccessibility` / SwiftUI modifiers only | React Native `accessibility*` props + `AccessibilityInfo` + Expo modules; verify on **VoiceOver (iOS)** and **TalkBack (Android)** |
| Dynamic Type via UIFontMetrics only | RN `allowFontScaling` (default true) + `maxFontSizeMultiplier` where layout must cap; prefer relative / scaled type over fixed `fontSize` for body UI; test largest accessibility sizes |
| `UIAccessibility.isReduceMotionEnabled` | `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged`; gate Reanimated / haptics / decorative motion |
| Storyboard RTL | `I18nManager` / Expo localization; layout with `start`/`end` (not raw left/right); `expo-localization` + i18n library when strings ship |
| Color contrast in Asset Catalog alone | Design-system semantic tokens (`software/design-system/tokens/colors.ts`) + WCAG AA checks in light **and** dark; Increase Contrast where OS exposes it |
| VoiceOver rotor / custom actions | RN `accessibilityActions` / `onAccessibilityAction`; chart **textual summaries** mandatory (see MacroSummary pattern) |

**Pointers**

- MVP backlog (#13): [`docs/issue-13-mvp-backlog.md`](./issue-13-mvp-backlog.md) (merged) — M1-21 owns execution; this doc is the gate checklist
- Privacy / offline-camera-free QA overlap (#22): [`docs/issue-22-privacy-security.md`](./issue-22-privacy-security.md) (merged)
- Freemium / paywall a11y (#14): [`docs/issue-14-freemium-matrix.md`](./issue-14-freemium-matrix.md) (merged) — continue-free never gated; paywalls need Reduce Motion + labels
- Design-system specimens: [`software/design-system/`](../software/design-system/) · Component gallery tab
- Rollout checklist: [`software/ROLLOUT-STATUS.md`](../software/ROLLOUT-STATUS.md)

**Hard exclusions (unchanged):** No MacroFactor trademarks, assets, copy, private APIs, food data, or Expenditure V3 reverse engineering. No ads or sale of nutrition/health profiling data.

---

## Scope (before external beta)

| Area | Platforms / settings | Pass bar |
| --- | --- | --- |
| **Screen readers** | VoiceOver (iOS), TalkBack (Android) | Focus order logical; every control labeled; actions discoverable; live regions / announcements correct; charts have textual summaries |
| **Text scaling** | iOS Dynamic Type / Larger Text; Android Font size + Display size to max supported | No clipped essential text; reflow; hit targets remain usable |
| **Touch targets** | Both | **44×44 pt/dp effective** minimum for primary controls (AX5 / WCAG 2.5.5 aspiration for critical actions) |
| **Contrast & color** | Light, dark; Increase Contrast if available; color-blind simulation | WCAG AA for text/UI; **nutrient meaning never color-alone** |
| **Motion** | Reduce Motion on | No essential info only in animation; decorative motion off / cross-fade |
| **Switch / Voice Control / keyboard** | iOS Voice Control / Switch Control; Android switch; web keyboard focus if web build ships | Focusable controls; no pointer-only traps |
| **Themes** | Light / dark (system + in-app if offered) | Semi-transparent / border / ink / muted contrast holds |
| **States** | Offline, error, empty, loading | Announced or labeled; not color-only; OfflinePill / ErrorBanner / EmptyState / LoadingState patterns |
| **Localization** | RTL + 1–2 expanding locales; numbers/dates/units/plurals | No truncated critical strings; locale-safe formatters; layout mirrors |

**Severity rubric (record in evidence log)**

| Severity | Definition | External beta |
| --- | --- | --- |
| **Critical** | Blocks task completion for AT users; missing label on primary action; color-only nutrient distinction on a decision UI; unreadable at max text size on core path | **Must close** |
| **Major** | Difficult / confusing; wrong focus order on secondary path; target &lt;44×44 on frequent controls; RTL mirror broken on primary nav | Fix or waive with product sign-off |
| **Minor** | Polish (redundant announcement, uneven spacing at large type) | Track; do not block if no criticals |
| **Enhancement** | Nice-to-have (custom rotor, richer chart sonification) | Backlog |

**Owners (default):** Engineering (Expo RN) implements; product verifies UX copy; this issue tracks the audit record. Assign per defect when filing follow-ups under #13 / new issues.

---

## Current scaffold snapshot (M1 design system)

Honest baseline against `software/design-system/` on `feat/m1-design-system-scaffold` — **not** a pass for external beta.

| Component / token | Present a11y hooks | Known gaps for #24 |
| --- | --- | --- |
| `PrimaryButton` | `accessibilityRole="button"`, `accessibilityState.disabled` | `minHeight` 42 (compact 36) — **below 44×44**; confirm width; add `accessibilityLabel` when `label` is icon-only later |
| `MacroSummary` | Aggregate `accessibilityLabel` with calorie/macro words; role `summary` | Color dots + border accents — keep text labels; expand when goals present; chart surfaces still TODO (M1-17) |
| `FoodRow` | Role button; name+detail label; action control labeled | Verify focus order name → action; long names at max scale |
| `ErrorBanner` | Role `alert`; action/dismiss buttons labeled | Confirm TalkBack double-announce; Reduce Motion on any slide-in |
| `OfflinePill` / `LoadingState` / `EmptyState` | Text / progressbar labels | Ensure empty CTAs meet 44×44; loading not only spinner |
| `ThemeProvider` | Light/dark via `useColorScheme` | No Increase Contrast token path yet; gallery `forcedScheme` OK for QA |
| `Typography` tokens | Fixed `fontSize` roles | No Dynamic Type scaling helper yet; `micro` (9pt) will fail large-type / contrast audits — avoid for essential info |
| i18n / RTL | Not wired (no `expo-localization` / i18n lib in `package.json` yet) | Strings are English literals; RTL smoke deferred until first string catalog — still **checklist-ready** now |
| Motion | `expo-haptics`, Reanimated present | No central Reduce Motion gate yet — required before decorative animation on diary/paywall |

**Rule:** New UI in M1–M3 must ship with labels, 44×44 targets, theme contrast, and textual alternatives for color/charts. Gallery specimens are the regression surface for component-level checks.

---

## VoiceOver (iOS) checklist

Run on a device or simulator with VoiceOver on. Exercise **Today / journal**, **Search / food row**, **Food detail / log**, **Weight chart** (when present), **Settings / offline**, **Paywall** (when present), and **Component gallery**.

| # | Check | Pass criteria | Evidence (path / build / date) | Sev if fail |
| --- | --- | --- | --- | --- |
| VO-01 | Focus order | Swipe-right order matches visual reading order; no focus traps | | Critical if core path |
| VO-02 | Control labels | Every `button` / `link` / `tab` has spoken name; icon-only has `accessibilityLabel` | | Critical |
| VO-03 | Roles | Buttons sound like buttons; alerts as alerts; tabs as tabs | | Major |
| VO-04 | Values / traits | Toggles, steppers, selected meal slots announce state | | Major |
| VO-05 | Custom actions | Swipe-up actions (e.g. favorite, delete) discoverable where offered | | Major |
| VO-06 | Announcements | ErrorBanner / offline / undo toast announced once without stealing focus incorrectly | | Major |
| VO-07 | Chart / macro summary | Weight and expenditure charts expose **textual summary** (pattern: MacroSummary aggregate label); not geometry-only | | Critical |
| VO-08 | Headers / landmarks | Section headers navigable via rotor Headings where marked | | Minor |
| VO-09 | Modal / sheet | Focus moves into sheet; escape/dismiss labeled; focus returns on close | | Critical |
| VO-10 | WebView (if any) | In-app browser content reachable or clearly “opens externally” | | Major |

---

## TalkBack (Android) checklist

Mirror VO checks on TalkBack (Explore by Touch + linear navigation). Note Android-specific gaps.

| # | Check | Pass criteria | Evidence | Sev if fail |
| --- | --- | --- | --- | --- |
| TB-01 | Focus order | Matches visual / reading order; `accessible={true}` grouping correct | | Critical if core path |
| TB-02 | Labels | `contentDescription` equivalent via RN props; no “unlabeled” | | Critical |
| TB-03 | Actions | Custom actions appear in TalkBack actions menu | | Major |
| TB-04 | Live regions | Errors / offline updates announced (`accessibilityLiveRegion` where needed) | | Major |
| TB-05 | Chart summaries | Same textual summary requirement as VO-07 | | Critical |
| TB-06 | System back | Back dismisses sheets predictably with announcement | | Major |
| TB-07 | Gesture conflicts | App gestures do not permanently block TalkBack passthrough | | Major |

---

## Dynamic Type / font scaling checklist

| # | Check | Pass criteria | Evidence | Sev if fail |
| --- | --- | --- | --- | --- |
| DT-01 | Max iOS accessibility sizes | Core paths usable at largest Larger Accessibility Text sizes | | Critical |
| DT-02 | Max Android font + display size | Same for Android largest settings | | Critical |
| DT-03 | Reflow | No essential truncation with `…` on primary labels; wrap or scroll | | Critical |
| DT-04 | Truncation policy | Secondary metadata may truncate; announce full string via label | | Major |
| DT-05 | Hit targets at scale | Controls remain ≥44×44 effective | | Critical |
| DT-06 | Fixed micro type | Do not use `Typography.micro` (9pt) for required reading | | Major |
| DT-07 | `maxFontSizeMultiplier` | Only where layout would otherwise break; document caps; never on legal/consent copy | | Major |
| DT-08 | Metric numbers | Calorie / gram figures remain legible; prefer scalable metric roles | | Major |

---

## Touch targets, contrast, color-blind, Increase Contrast

| # | Check | Pass criteria | Evidence | Sev if fail |
| --- | --- | --- | --- | --- |
| TC-01 | 44×44 | PrimaryButton default, FoodRow action, tab bar, stepper ± meet **44×44** effective | | Critical on primary |
| TC-02 | Spacing | Adjacent targets not overlapping activation regions | | Major |
| TC-03 | Contrast text | Ink on canvas/raised and muted on canvas meet **WCAG AA** (4.5:1 body, 3:1 large) in light **and** dark | | Critical |
| TC-04 | Non-text contrast | Borders / icons that convey state ≥3:1 | | Major |
| TC-05 | Increase Contrast | If OS setting available, UI remains usable (token boost or system colors) | | Major |
| TC-06 | Color-blind | Deuteranopia / protanopia simulation: protein / fat / carbs / energy still distinguishable via **label + pattern/position**, not hue alone | | Critical |
| TC-07 | Nutrient meaning | Macro chips, chart series, and legend always include text (or pattern); color is reinforcement only | | Critical |
| TC-08 | Danger / brand | Destructive actions not red-only — include text “Delete” / “Remove” | | Critical |

---

## Reduce Motion, Voice Control / switch, keyboard / web focus

| # | Check | Pass criteria | Evidence | Sev if fail |
| --- | --- | --- | --- | --- |
| RM-01 | Detect | App reads `AccessibilityInfo.isReduceMotionEnabled()` at startup and on change | | Major (Critical if motion-only info) |
| RM-02 | Decorative | Parallax, looping Lottie, celebratory confetti disabled or instant | | Major |
| RM-03 | Essential | Progress / state changes use opacity / instant cut, not required motion | | Critical if motion-only |
| RM-04 | Haptics | Optional; do not convey unique info only via haptic | | Minor |
| RM-05 | Reanimated | Shared animation helpers respect reduce-motion flag | | Major |
| VC-01 | Voice Control | Visible names match spoken labels for primary buttons | | Major |
| SW-01 | Switch Control | Full core path completable sequentially | | Major |
| KB-01 | Keyboard / web | If Expo web is a supported surface: visible focus ring; tab order; no keyboard trap | | Major if web ships |

---

## Themes + offline / error / empty / loading

| # | Check | Pass criteria | Evidence | Sev if fail |
| --- | --- | --- | --- | --- |
| TH-01 | Light | Gallery + core screens contrast OK | | Critical |
| TH-02 | Dark | Same; nutrient accents still labeled | | Critical |
| TH-03 | Forced scheme | Gallery `forcedScheme` usable for QA screenshots | | Minor |
| ST-01 | Offline | `OfflinePill` (or equivalent) visible + announced; diary still usable offline in M1 | | Critical |
| ST-02 | Error | `ErrorBanner` role alert; retry/dismiss labeled | | Critical |
| ST-03 | Empty | `EmptyState` explains next action; CTA labeled + 44×44 | | Major |
| ST-04 | Loading | `LoadingState` progressbar label; not infinite silent spinner on core path | | Major |

---

## Locales, RTL, numbers, dates, units, plurals

Ship English first is OK for internal builds; **external beta** needs at least an RTL smoke and formatter discipline even if only one language is complete.

| # | Check | Pass criteria | Evidence | Sev if fail |
| --- | --- | --- | --- | --- |
| LO-01 | String catalog | No user-facing literals trapped in non-translatable templates long-term; plan `expo-localization` + i18n | | Major before multi-locale |
| LO-02 | RTL smoke | Force RTL (`I18nManager` / per-app language): nav, rows, chevrons, sheets mirror; no clipped leading/trailing | | Critical if RTL locale ships |
| LO-03 | Expansion | Pseudo-loc or German/French expansion (~30–40%) without breaking primary buttons | | Major |
| LO-04 | Numbers | Use `Intl.NumberFormat` / locale-aware helpers — not hardcoded `,` / `.` assumptions for calories/macros | | Critical |
| LO-05 | Dates / times | Locale-aware diary timestamps; relative “Today” strings translated | | Major |
| LO-06 | Units | kg/lb, kcal/kJ (if offered) flip with profile; announcements include unit | | Critical |
| LO-07 | Plurals | ICU / plural rules for “1 item” / “N items”, grams, etc. | | Major |
| LO-08 | Layout APIs | Prefer `marginStart`/`paddingEnd` / `flexDirection: 'row'` with start-end awareness over raw left/right | | Major |
| LO-09 | Screenshots / store | Localized store listing screenshots when locales ship | | Minor (store) |
| LO-10 | Paywall copy | Localized IAP strings from stores; custom paywall text in catalog | | Major when IAP ships |

---

## Nutrient meaning — not by color alone (binding)

| Surface | Required non-color channel |
| --- | --- |
| MacroSummary chips | Visible text label (Calories / Protein / Fat / Carbs) + numeric value; a11y aggregate sentence |
| Charts (weight, intake, expenditure) | Series name in legend **and** accessibility summary string (min/max/latest/trend in words) |
| Food detail nutrient list | Text names always; bars/dots optional |
| Coaching insights | Never “the orange line” without naming the metric |
| Widgets / complications (future) | Text or distinct shape/pattern |

**Fail condition:** Any decision UI where a color-blind user cannot tell protein from carbs/fat/energy without guessing.

---

## Evidence log template

Copy rows into PR comments or a spreadsheet; attach screenshots / screen recordings under `out/a11y/` (local; do not commit PHI).

| ID | Platform | Build | Tester | Result (pass/fail) | Sev | Owner | Notes / link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VO-01 | iOS | | | | | | |
| TB-01 | Android | | | | | | |
| DT-01 | iOS | | | | | | |
| TC-06 | both | | | | | | |
| RM-01 | both | | | | | | |
| LO-02 | both | | | | | | |
| … | | | | | | | |

**Close rule:** Zero open **Critical** rows before external beta. Majors need product waiver or fix.

---

## Review gates (before betas)

| Beta type | Must be complete |
| --- | --- |
| **Internal / TestFlight dogfood** | Component gallery VO/TB smoke; PrimaryButton → 44×44 tracked; MacroSummary color+text verified |
| **External beta (friends & family)** | Full VO + TB core paths; max text scale; Reduce Motion; light/dark; offline/error/empty/loading; color-blind check on macros/charts; **no criticals** |
| **Store external** | Above + RTL/locale policy for shipped languages; paywall a11y (M3-11); beta readiness (M3-19) |

**Approval record:** This PR is the audit checklist submission. Nicholas (product) + engineering must sign off that criticals are closed before external beta. Implementation / remediation remains in #13 (M1-21 et al.); do not treat merge of this doc as beta authorization.

---

## Milestone posture

| When | A11y / l10n posture |
| --- | --- |
| **M1** | Design-system labels on specimens; track 44×44 + Dynamic Type gaps; M1-21 camera-free a11y/l10n/privacy QA; gallery as regression harness; English OK |
| **M2** | E2E offline/network/a11y regression (M2-19); provider error states labeled; health consent screens fully accessible |
| **M3** | Paywalls + Reduce Motion (M3-11); localized IAP; charts with summaries (M3-07); beta readiness audit (M3-19) closes remaining criticals |

---

## Remediations already visible (file under #13 / M1-21 — not this PR)

Docs-only PR: **no primary implementation edits.** Track these as engineering follow-ups:

1. Raise `PrimaryButton` (and compact variant policy) to **min 44×44** effective touch target.
2. Add Dynamic Type / font-scale helpers; avoid `micro` for essential copy.
3. Central `useReduceMotion()` gating Reanimated + decorative haptics.
4. Wire `expo-localization` + message catalog before first non-English or RTL external build.
5. Chart components (M1-17 / M3-07) must ship textual summaries from day one.
6. Contrast audit on `muted` (#777 on #f9f9f9) — verify AA; darken if needed.
7. Document Increase Contrast strategy (token boost vs system).

---

## Bottom line

Macro-tracker ships inclusive by default: **VoiceOver and TalkBack** labels and focus order, **Dynamic Type** reflow, **44×44** targets, **light/dark** contrast, **Reduce Motion**, **locale-safe** numbers/dates/units/plurals and RTL readiness, and **nutrient meaning never by color alone**. Critical defects block external beta; this document is the checklist and evidence record. Component remediation stays in #13 — this issue does not replace M1-21 execution.
