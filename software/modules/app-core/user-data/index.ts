export type { SqlExecutor, SqlRow } from './sqlExecutor';
export { openSqlJsDatabase } from './openSqlJs';
export { wrapExpoSqlite } from './openExpo';
export {
  migrateUserStore,
  loadUserStoreSchemaSql,
  userStoreSchemaPath,
  USER_STORE_SCHEMA_VERSION,
  USER_STORE_V1_VERSION,
} from './migrate';
export { USER_STORE_V1_SQL } from './schemaV1';
export { USER_STORE_V2_PROFILE_SQL } from './schemaV2';
export {
  serializeNutrients,
  parseNutrients,
  isExplicitZero,
  isMissing,
  type NutrientMap,
} from './nutrients';
export {
  createCustomFood,
  getCustomFood,
  updateCustomFoodNutrients,
  deleteCustomFood,
  listCustomFoods,
  type CustomFood,
  type CustomFoodCreate,
} from './customFoodRepo';
export {
  listFavorites,
  type FavoriteRecord,
  type FoodKind,
} from './favoriteRepo';
export {
  listRecentFoods,
  type RecentFoodRecord,
} from './recentFoodRepo';
export {
  createDiaryEntry,
  listDiaryEntriesForDay,
  getDiaryEntry,
  tombstoneDiaryEntry,
  restoreDiaryEntry,
  updateDiaryEntryNutrition,
  type DiaryEntry,
  type DiaryEntryCreate,
  type DiaryEntryNutritionPatch,
} from './diaryEntryRepo';
export { ensureDefaultMealSlots, listMealSlots } from './mealSlots';
export {
  COACHING_EXCLUSION_KEYS,
  parseExclusionsJson,
  serializeExclusions,
  coachingShellEnabled,
  type CoachingExclusionKey,
} from './exclusions';
export { computeStarterTarget, type StarterTarget } from './starterTarget';
export {
  LOCAL_PROFILE_ID,
  ONBOARDING_STEPS,
  type MassUnit,
  type HeightUnit,
  type EnergyUnit,
  type Sex,
  type GoalKind,
  type OnboardingStep,
  type UserProfile,
  type UserGoal,
  type DailyTarget,
} from './profileTypes';
export {
  getProfile,
  ensureProfile,
  updateProfile,
  isOnboardingComplete,
  type ProfilePatch,
} from './profileRepo';
export {
  getActiveGoal,
  setActiveGoal,
  getLatestTarget,
  saveStarterTarget,
} from './goalRepo';
export {
  loadOnboardingSnapshot,
  saveAdultGate,
  saveUnits,
  saveBiometrics,
  saveGoalStep,
  saveExclusionsStep,
  completeOnboardingWithStarterTarget,
  setOnboardingStep,
  nextStepAfter,
  type OnboardingSnapshot,
} from './onboarding';

export {
  kgToLb,
  lbToKg,
  cmToIn,
  inToCm,
  round1,
} from './unitConvert';
