# Food detail / log sheet (M1-13)

Pure calc + atomic diary insert for logging a Search/browse selection into Today.

- **Grams** or **source servings**, decimal quantity, meal slot + timestamp
- **Live nutrient math** from per-100 g (seed) or custom basis nutrients
- **Invalid / negative / zero** quantities blocked
- **Atomic** `BEGIN`/`COMMIT` around `diary_entry` insert
- Edit/delete/undo belong to **M1-14** — not implemented here

Demo: `docs/demo/smoke-m1-13-food-detail.sh`

Meal/time defaults (#150): choose the timed slot nearest the current local clock
within the same day, with ties going to the later meal (no midnight wrap).
For the built-in slots, Breakfast applies before 10:15, Lunch from 10:15 to
15:29, and Dinner from 15:30 onward. Untimed slots such as Snacks remain explicit
choices; if all slots are untimed, fall back to the first slot. Today uses now
(to the minute); other dates use that slot's default time, or now if unset.
An explicit initial slot wins over the clock rule. Choosing a meal chip keeps
its existing behavior of setting that meal's default time when available.
Defaults initialize when the sheet opens or its food/date changes, so rerenders
while editing preserve the user's choice.
