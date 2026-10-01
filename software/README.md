# Nutrition Tracker (Expo)

Expo Router app targeting iOS/Android/web. Visual source of truth for UI is the HTML design-system library (research tree); RN tokens live in `design-system/`.

## Scripts

- `npm start` — Expo dev server
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Node unit tests (tokens + secret-scan)
- `npm run secret-scan` — credential pattern scan
- `npm run ci` — typecheck + lint + secret-scan + test

CI workflow YAML: `docs/github-workflows/ci.yml` (copy to `.github/workflows/ci.yml` when the pushing token has the `workflow` scope). Local demo: `bash docs/demo/smoke-ci.sh`.

## Design system

```ts
import { ThemeProvider, PrimaryButton, MacroSummary } from '@/design-system';
```

See `ROLLOUT-STATUS.md` for M1 checklist status.
