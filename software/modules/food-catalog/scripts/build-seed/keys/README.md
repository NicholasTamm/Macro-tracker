# FoodSeed signing keys (M1-08)

| File | Role |
| --- | --- |
| `food-seed-2026-01.pub` | Trusted Ed25519 public key (SPKI PEM). Embed / ship with the app for M1-20 verify. |
| `food-seed-2026-01.dev.pkcs8` | **Dev-only** PKCS8 private key used by the fixture/local seed build to produce real signatures. |

`signingKeyID` in manifests: `food-seed-2026-01`.

## Production note

Rotate before any public CDN release. Do not reuse this committed private key for production CDN artifacts — generate a new keypair out-of-band, store the private half in CI secrets, and update the embedded public key + `signingKeyID`.

## Override

```bash
FOOD_SEED_SIGNING_KEY=/path/to/private.pkcs8 \
FOOD_SEED_SIGNING_KEY_ID=food-seed-2026-01 \
  node build-seed.mjs
```
