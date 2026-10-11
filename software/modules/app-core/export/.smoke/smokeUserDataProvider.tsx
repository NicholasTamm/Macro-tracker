import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createCustomFood,
  createDiaryEntry,
  createWeightSample,
  ensureDefaultMealSlots,
  ensureProfile,
  listMealSlots,
  loadOnboardingSnapshot,
  migrateUserStore,
  openSqlJsDatabase,
  saveStarterTarget,
  setActiveGoal,
  updateProfile,
  type OnboardingSnapshot,
  type SqlExecutor,
} from '../../user-data';

type SmokeUserData = {
  db: SqlExecutor | null;
  ready: boolean;
  snapshot: OnboardingSnapshot | null;
};

const SmokeUserDataContext = createContext<SmokeUserData | null>(null);

async function buildRoundTripFixture(): Promise<SmokeUserData> {
  const db = await openSqlJsDatabase();
  migrateUserStore(db);
  ensureProfile(db);
  updateProfile(db, {
    isAdultConfirmed: true,
    massUnit: 'kg',
    heightUnit: 'cm',
    energyUnit: 'kcal',
    sex: 'male',
    birthYear: 1995,
    heightCm: 180,
    weightKg: 80,
  });
  setActiveGoal(db, { goalKind: 'maintain' });
  saveStarterTarget(db, {
    energyKcal: 2500,
    proteinG: 150,
    carbohydrateG: 250,
    fatG: 80,
  }, undefined, '2026-10-04');
  ensureDefaultMealSlots(db);
  const slots = listMealSlots(db);
  createDiaryEntry(db, {
    timestamp: '2026-10-04T15:00:00.000Z',
    localDayKey: '2026-10-04',
    timezoneIdentifier: 'America/Vancouver',
    mealSlotId: slots[0]?.id ?? null,
    foodKind: 'seed',
    foodStableId: 'usda-foundation:748967',
    foodDisplayName: 'Egg',
    foodLicenseTag: 'USDA',
    quantity: 2,
    unitLabel: 'large',
    grams: 100,
    nutritionSnapshot: {
      energy_kcal: 143,
      protein: 12.6,
      fat_total: 9.5,
      carbohydrate: 0.7,
    },
    sourceDisplayName: 'USDA FoodData Central',
    licenseTag: 'USDA',
  });
  createWeightSample(db, {
    timestamp: '2026-10-04T08:00:00.000Z',
    kilograms: 80.2,
    source: 'manual',
  });
  createCustomFood(db, {
    name: 'Export Yogurt',
    basisKind: 'mass',
    basisAmount: 170,
    basisUnit: 'g',
    gramWeightForBasis: 170,
    nutrients: {
      energy_kcal: 130,
      protein: 17,
      fat_total: 0,
      carbohydrate: 14,
    },
  });
  return { db, ready: true, snapshot: loadOnboardingSnapshot(db) };
}

export function SmokeUserDataProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<SmokeUserData>({
    db: null,
    ready: false,
    snapshot: null,
  });

  useEffect(() => {
    let cancelled = false;
    buildRoundTripFixture()
      .then((fixture) => {
        if (!cancelled) {
          setValue(fixture);
          document.title = 'export-ready';
        }
      })
      .catch((error) => {
        document.title = `export-error:${error instanceof Error ? error.message : String(error)}`;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SmokeUserDataContext.Provider value={value}>
      {children}
    </SmokeUserDataContext.Provider>
  );
}

export function useUserData(): SmokeUserData {
  const value = useContext(SmokeUserDataContext);
  if (!value) throw new Error('useUserData must be used within SmokeUserDataProvider');
  return value;
}
