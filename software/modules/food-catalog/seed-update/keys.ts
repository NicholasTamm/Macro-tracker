export const FOOD_SEED_2026_01_KEY_ID = 'food-seed-2026-01';

/** Rotate this app-embedded allowlist before a production CDN launch. */
export const PINNED_SEED_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({
  [FOOD_SEED_2026_01_KEY_ID]: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAH1yB9mwF7ipT2GJ63g2FHwFl5QKocOrJKJImvUEPa/g=
-----END PUBLIC KEY-----`,
});
