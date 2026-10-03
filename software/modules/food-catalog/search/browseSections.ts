/**
 * Empty-query browse sections: Recent / Favorites / My Foods (M1-12).
 * Pure assembly — callers supply listed records (user-data) + optional seed repo.
 * Write/quick-add paths belong to M1-16.
 */
import type { LocalFoodRepository } from '../local-food-repo';
import {
  formatResultDetail,
  macrosFromNutrientMap,
  macrosFromNutrientRows,
} from './formatResultDetail';

export type BrowseItemKind = 'seed' | 'custom' | 'off' | 'fdc_branded' | 'fatsecret';

export type BrowseListRecord = {
  foodKind: BrowseItemKind;
  foodStableId: string;
  foodDisplayName: string;
  foodLicenseTag: string;
  foodBrand?: string | null;
};

export type CustomBrowseRecord = {
  id: string;
  name: string;
  brand: string | null;
  nutrients: Record<string, number | null | undefined>;
};

export type BrowseItem = {
  key: string;
  foodKind: BrowseItemKind;
  foodStableId: string;
  name: string;
  detail: string;
  sourceLabel: string;
};

export type BrowseSectionId = 'recent' | 'favorites' | 'my_foods';

export type BrowseSection = {
  id: BrowseSectionId;
  title: string;
  items: BrowseItem[];
};

function seedDetail(
  repo: LocalFoodRepository | null,
  foodStableId: string,
  fallbackLicense: string,
): { detail: string; sourceLabel: string } {
  const empty = {
    energyKcal: null,
    proteinG: null,
    fatG: null,
    carbG: null,
  };
  if (!repo) {
    return {
      sourceLabel: fallbackLicense,
      detail: formatResultDetail(fallbackLicense, empty),
    };
  }
  const food = repo.getFood(foodStableId);
  if (!food) {
    return {
      sourceLabel: fallbackLicense,
      detail: formatResultDetail(fallbackLicense, empty),
    };
  }
  const source = repo.getSource(food.sourceId);
  const sourceLabel = source?.displayName ?? food.sourceId;
  const macros = macrosFromNutrientRows(repo.getNutrients(food.foodId));
  return { sourceLabel, detail: formatResultDetail(sourceLabel, macros) };
}

function fromListed(
  prefix: string,
  rec: BrowseListRecord,
  repo: LocalFoodRepository | null,
): BrowseItem {
  if (rec.foodKind === 'seed') {
    const { detail, sourceLabel } = seedDetail(repo, rec.foodStableId, rec.foodLicenseTag);
    return {
      key: `${prefix}:${rec.foodKind}:${rec.foodStableId}`,
      foodKind: rec.foodKind,
      foodStableId: rec.foodStableId,
      name: rec.foodDisplayName,
      detail,
      sourceLabel,
    };
  }
  const sourceLabel =
    rec.foodKind === 'custom' ? 'My Foods' : rec.foodLicenseTag || rec.foodKind;
  return {
    key: `${prefix}:${rec.foodKind}:${rec.foodStableId}`,
    foodKind: rec.foodKind,
    foodStableId: rec.foodStableId,
    name: rec.foodDisplayName,
    detail: formatResultDetail(sourceLabel, {
      energyKcal: null,
      proteinG: null,
      fatG: null,
      carbG: null,
    }),
    sourceLabel,
  };
}

function fromCustom(food: CustomBrowseRecord): BrowseItem {
  const macros = macrosFromNutrientMap(food.nutrients);
  const sourceLabel = food.brand ? `My Foods · ${food.brand}` : 'My Foods';
  return {
    key: `custom:${food.id}`,
    foodKind: 'custom',
    foodStableId: food.id,
    name: food.name,
    detail: formatResultDetail(sourceLabel, macros),
    sourceLabel,
  };
}

export function buildBrowseSections(input: {
  recent?: BrowseListRecord[];
  favorites?: BrowseListRecord[];
  myFoods?: CustomBrowseRecord[];
  seedRepo?: LocalFoodRepository | null;
}): BrowseSection[] {
  const repo = input.seedRepo ?? null;
  return [
    {
      id: 'recent',
      title: 'Recent',
      items: (input.recent ?? []).map((r) => fromListed('recent', r, repo)),
    },
    {
      id: 'favorites',
      title: 'Favorites',
      items: (input.favorites ?? []).map((f) => fromListed('fav', f, repo)),
    },
    {
      id: 'my_foods',
      title: 'My Foods',
      items: (input.myFoods ?? []).map(fromCustom),
    },
  ];
}
