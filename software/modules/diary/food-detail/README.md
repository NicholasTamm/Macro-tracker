# Food detail / log sheet (M1-13)

Pure calc + atomic diary insert for logging a Search/browse selection into Today.

- **Grams** or **source servings**, decimal quantity, meal slot + timestamp
- **Live nutrient math** from per-100 g (seed) or custom basis nutrients
- **Invalid / negative / zero** quantities blocked
- **Atomic** `BEGIN`/`COMMIT` around `diary_entry` insert
- Edit/delete/undo belong to **M1-14** — not implemented here

Demo: `docs/demo/smoke-m1-13-food-detail.sh`
