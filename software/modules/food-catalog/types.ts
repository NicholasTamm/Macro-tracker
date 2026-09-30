/**
 * Food catalog / seed contract types (Expo + TypeScript).
 * Supersedes Swift FoodCandidate / SwiftData models from OUT/food-schema.md.
 */

import type { NutrientId } from './nutrients';
import { CATALOG_SCHEMA_VERSION } from './nutrients';

export { CATALOG_SCHEMA_VERSION };

/** Deterministic catalog id: `<source>:<external-id>`. */
export type FoodId = string;

export type FoodSourceKind =
  | 'usda-foundation'
  | 'usda-sr-legacy'
  | 'custom'
  | 'off'
  | 'fdc-branded'
  | 'fatsecret';

export type FoodReferenceKind = 'seed' | 'custom' | 'off' | 'fdc_branded' | 'fatsecret';

export type NutrientAmount = number | null;

export interface NutrientValue {
  nutrientId: NutrientId | string;
  amount: NutrientAmount;
  unit: string;
}

export interface ServingDTO {
  sequence: number;
  quantity: number;
  unit: string;
  modifier?: string | null;
  gramWeight: number;
  isDefault?: boolean;
}

export interface Attribution {
  sourceDisplayName: string;
  licenseSpdx: string;
  attributionText: string;
  sourceUrl?: string | null;
}

export type PersistencePolicy =
  | { kind: 'durableWithAttribution' }
  | { kind: 'expires'; expiresAt: string }
  | { kind: 'identifiersOnly' }
  | { kind: 'noSharedCache' };

export type DataQuality = 'high' | 'medium' | 'low' | 'unknown';

/** In-memory DTO for seed + remote providers (replaces Swift FoodCandidate). */
export interface FoodCandidate {
  id: string;
  source: FoodSourceKind;
  externalId: string;
  gtin14?: string | null;
  name: string;
  brand?: string | null;
  nutrientsPer100g: Record<string, NutrientAmount>;
  servings: ServingDTO[];
  sourceUrl?: string | null;
  attribution: Attribution;
  fetchedAt: string;
  expiresAt?: string | null;
  persistence: PersistencePolicy;
  dataQuality: DataQuality;
}

export interface FoodReference {
  kind: FoodReferenceKind;
  stableId: string;
  providerId?: string | null;
  gtin14?: string | null;
  displayName: string;
  brand?: string | null;
  licenseTag: string;
}

export interface NutritionSnapshot {
  perLoggedAmount: Record<string, NutrientAmount>;
  basisGrams?: number | null;
  capturedAt: string;
  catalogSeedVersion?: string | null;
}

export interface SeedManifestArtifact {
  url: string;
  compression: 'zstd' | 'gzip' | 'none';
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  signature: string;
  signingKeyID: string;
}

export interface SeedManifestSource {
  id: string;
  release: string;
  downloadURL: string;
  retrievedAt: string;
  archiveSHA256: string;
  license: string;
  attribution: string;
}

export interface SeedManifest {
  manifestVersion: 1;
  catalogSchemaVersion: typeof CATALOG_SCHEMA_VERSION;
  seedVersion: string;
  minimumAppBuild: number;
  createdAt: string;
  artifact: SeedManifestArtifact;
  content: {
    foodCount: number;
    servingCount: number;
    nutrientValueCount: number;
    ftsDocumentCount: number;
    locales: string[];
  };
  sources: SeedManifestSource[];
  releaseNotes: string;
}

export interface FoodCatalogModuleInfo {
  name: 'food-catalog';
  catalogSchemaVersion: typeof CATALOG_SCHEMA_VERSION;
  userStoreSchemaVersion: 1;
  status: 'contract';
}
