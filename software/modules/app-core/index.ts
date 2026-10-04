/** Shared app foundation — feature flags, route keys, UserData.sqlite (RN). */
export const AppCore = {
  moduleName: 'app-core',
  productWorkingTitle: 'Nutrition Tracker',
  stack: 'expo-react-native',
} as const;

export type FeatureFlags = {
  seedUpdaterEnabled: boolean;
  cloudSyncEnabled: boolean;
  healthKitEnabled: boolean;
  coachingEnabled: boolean;
  paywallEnabled: boolean;
};

export const milestone1Flags: FeatureFlags = {
  seedUpdaterEnabled: false,
  cloudSyncEnabled: false,
  healthKitEnabled: false,
  coachingEnabled: false,
  paywallEnabled: false,
};

export type AppRoute =
  | 'journal'
  | 'food-entry'
  | 'analytics'
  | 'settings'
  | 'component-gallery'
  | 'onboarding';

export * from './user-data';

export * from './export';
