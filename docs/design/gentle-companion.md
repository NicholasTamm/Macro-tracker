# Gentle companion: art fence rule

Direction B ("Gentle companion", parent issue #128) keeps MacroFactor's calm,
neutral shell and nutrient colours, and adds one consistent set of cartoon food
icons and one abstract mascot. The art is only allowed outside the **data zone**.

## Where cartoon art may appear

- Onboarding: first step (welcome) and last step (plan ready)
- Empty states: empty diary day, empty food search browse, no weigh-ins yet
- Check-ins, streaks and the daily goal hit moment (a card outside `MacroSummary`)
- Food icons in food rows (search, recents, favourites, diary rows) as a small
  decorative glyph next to the food name

## Where it may not appear (the data zone)

- Diary numbers, totals and meal-slot numbers
- `MacroSummary` and any macro/energy ring or bar
- `WeightChart` and every other chart, axis or trend line
- Food detail (serving, nutrients, amounts)
- Settings and data screens (export, licences, privacy)

## Tokens

Use the illustration roles in `software/design-system/tokens/colors.ts`
(`illoProteinTint`, `illoCarbsTint`, `illoFatTint`, `illoEnergyTint`,
`mascotTint`, `mascot`) only for art. Data series keep their existing
`energy` / `protein` / `fat` / `carbs` / `expenditure` / `weightTrend` tokens.
`onBrand` is the foreground paired with `brand`, including for button-label text.

## Brand button

`PrimaryButton variant="brand"` is brand orange (`#ff8b41`) with dark `onBrand`
ink (`#1f1b16`, about 7.3:1). Never put white text on brand orange (about 2.3:1).
Use the brand variant for Gentle companion CTAs (onboarding, empty states).

## Rules for art

- Decorative only: hide from screen readers; the copy carries the meaning.
- Flat fills, no outlines, no gradients; at most three colours per mascot pose.
- Nothing may depend on final generated mascot art (#127); placeholder art must
  render the same API.
