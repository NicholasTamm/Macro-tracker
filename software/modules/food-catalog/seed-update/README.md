# Seed update client (M1-20)

`runSeedUpdate` is a feature-flagged, dependency-injected pipeline for a future
FoodSeed CDN. `SEED_UPDATE_ENABLED` is deliberately `false` until that CDN is
available. The caller supplies network, SHA-256, Ed25519, free-space, and
storage ports; no native dependency is added or wired into the app yet.

The client validates the manifest before download, rejects unknown signing key
IDs from `PINNED_SEED_PUBLIC_KEYS`, reserves compressed + uncompressed space
plus a 1 MiB margin, hashes the downloaded artifact, and verifies the Ed25519
signature over the lowercase SHA-256 hex string. Only then does it stage and
atomically activate the bytes. The `SeedStore` compare-and-swap contract keeps
the old pointer and seed intact on failure.

`InMemorySeedStore` is the test/reference implementation. `expoSeedStore.ts` is
an unwired adapter sketch kept behind `require('expo-file-system')`. It writes
staged artifacts through temporary files and serializes pointer compare/swap
operations. A durable backup marker preserves the prior pointer if iOS removes
the destination before a pointer rename fails. Seed artifacts are retained for
rollback. A CDN integration must also add the matching zstd
decompression/opening path before enabling the flag.
