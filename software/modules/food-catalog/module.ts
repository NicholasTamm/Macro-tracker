import type { FoodCatalogModuleInfo } from './types';
import { CATALOG_SCHEMA_VERSION } from './nutrients';

export const FoodCatalogModule: FoodCatalogModuleInfo = {
  name: 'food-catalog',
  catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
  userStoreSchemaVersion: 1,
  status: 'contract',
};
