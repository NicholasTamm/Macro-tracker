type ManifestSource = {
  id?: string;
  release?: string;
  attribution?: string;
};

export type SeedManifestCitationInput = {
  sources?: ManifestSource[];
};

export const USDA_CITATION_FALLBACK =
  'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2024. fdc.nal.usda.gov.';

const DATASET_NAMES: Record<string, string> = {
  'usda-foundation': 'Foundation Foods',
  'usda-sr-legacy': 'SR Legacy',
  'fdc-branded': 'Branded Foods',
};

function releaseYear(release: string | undefined): string | null {
  const match = release?.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
}

export function buildUsdaCitation(manifest?: SeedManifestCitationInput | null): string {
  const usdaSources = (manifest?.sources ?? []).filter(
    (source) => source.id?.startsWith('usda-') || source.id === 'fdc-branded',
  );
  if (usdaSources.length === 0) return USDA_CITATION_FALLBACK;

  const years = usdaSources
    .map((source) => releaseYear(source.release))
    .filter((year): year is string => year != null);
  const year = years.sort().at(-1) ?? '2024';
  const datasets = usdaSources
    .map((source) => {
      const name = source.id ? DATASET_NAMES[source.id] ?? source.id : 'Dataset';
      return source.release ? `${name} (${source.release})` : name;
    })
    .join('; ');

  return `U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, ${year}. fdc.nal.usda.gov. Datasets: ${datasets}.`;
}
