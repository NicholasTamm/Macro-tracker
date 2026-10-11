# M1-25 — Settings navigation and choice accessibility QA

**Issue:** #74 · **Tier:** B  
**Automated gate:** `software/scripts/qa-m1-25.test.mjs`  
**Demo:** `bash docs/demo/smoke-m1-issue-74.sh`

## Automated coverage

- Every custom stack back control is statically gated at 44×44, has a button role and destination label, mirrors in RTL, and draws a keyboard focus outline.
- Settings replaces Expo Router's default route-derived back text with `Back to Settings`; onboarding labels each previous destination.
- Mutually exclusive choices have a labelled `radiogroup`; every row has radio semantics and checked state on native.
- The React Native Web server-rendered DOM is asserted to contain `role="radiogroup"`, `role="radio"`, `aria-checked`, and `tabindex="0"`.
- The multi-select safety-exclusion rows use checkbox semantics instead of being misrepresented as radios.
- The existing M1-21 contrast, Reduce Motion, RTL, privacy, permission, and screen-reader gates remain in the full suite.

## Manual screen-reader and keyboard smoke

These device steps are required before external beta; they cannot be cleared by static or server-rendered DOM tests.

### VoiceOver (iOS)

1. Enable VoiceOver and open Settings → Units & appearance.
2. Focus the header control. Confirm it announces “Back to Settings, button” and its full 44pt region activates it.
3. Move through each Mass, Height, Energy, and Theme group. Confirm each row announces its label, radio role, checked state, and group/position context where VoiceOver supplies it.
4. Activate every option and confirm the checked announcement follows the selection.
5. Repeat the header and choice checks through onboarding Units, About you, and Goal.

### TalkBack (Android)

1. Enable TalkBack and repeat the Settings and onboarding paths above.
2. Confirm each header control announces its destination and never announces `(tabs)`.
3. Confirm radio rows announce checked/not checked and group context; confirm Safety exclusions announce as checkboxes and allow multiple selections.

### Web keyboard and accessibility tree

1. Run `npm run web`, open onboarding and Settings → Units & appearance, and inspect the browser accessibility tree.
2. Confirm labelled radio-group nodes contain radio nodes with changing `checked` values.
3. Press Tab/Shift+Tab through every choice and header back control. Confirm the token-coloured focus outline is visible.
4. Activate each focused choice with Space or Enter and confirm its checked value changes.
5. Confirm the back target measures at least 44×44 CSS pixels and is named for its destination.

