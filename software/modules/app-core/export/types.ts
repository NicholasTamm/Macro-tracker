import type { NutrientMap } from '../user-data/nutrients';

/** Offline user-data export payload (M1-19). No shared FoodSeed catalog dump. */
export type ExportProvenance = {
  exportedAt: string;
  appId: 'macro-tracker';
  schemaVersion: string;
  formatVersion: 1;
  note: string;
};

export type ExportProfile = {
  id: string;
  isAdultConfirmed: boolean;
  massUnit: string;
  heightUnit: string;
  energyUnit: string;
  sex: string | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  exclusions: string[];
  onboardingStep: string;
  onboardingCompletedAt: string | null;
};

export type ExportGoal = {
  id: string;
  profileId: string;
  goalKind: string;
  rateKgPerWeek: number | null;
  isActive: boolean;
};

export type ExportTarget = {
  id: string;
  profileId: string;
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  source: string;
  effectiveFrom: string;
};

export type ExportDiaryEntry = {
  id: string;
  timestamp: string;
  localDayKey: string;
  timezoneIdentifier: string;
  mealSlotId: string | null;
  foodKind: string;
  foodStableId: string;
  foodDisplayName: string;
  foodLicenseTag: string;
  quantity: number;
  unitLabel: string;
  grams: number | null;
  nutritionSnapshot: NutrientMap;
  sourceDisplayName: string;
  licenseTag: string;
  deletedAt: string | null;
};

export type ExportWeight = {
  id: string;
  timestamp: string;
  kilograms: number;
  source: string;
  confirmedOutlier: boolean;
  deletedAt: string | null;
};

export type ExportCustomFood = {
  id: string;
  name: string;
  brand: string | null;
  barcodeGtin14: string | null;
  basisKind: string;
  basisAmount: number;
  basisUnit: string;
  gramWeightForBasis: number | null;
  nutrients: NutrientMap;
  isArchived: boolean;
  deletedAt: string | null;
};

export type UserDataExport = {
  provenance: ExportProvenance;
  profile: ExportProfile | null;
  goals: ExportGoal[];
  targets: ExportTarget[];
  diaryEntries: ExportDiaryEntry[];
  weights: ExportWeight[];
  customFoods: ExportCustomFood[];
};

export type ExportFiles = {
  json: string;
  csv: string;
  suggestedJsonName: string;
  suggestedCsvName: string;
};
