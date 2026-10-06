import { Text } from 'react-native';
import { Card, useTheme } from '@/design-system';
import { useFoodCatalog } from '@/components/FoodCatalogProvider';
import seedManifest from '@/modules/food-catalog/assets/seed-manifest.fixture.json';
import { buildUsdaCitation } from '@/modules/app-core/settings';
import { SettingsShell } from './SettingsShell';

export default function AboutScreen() {
  const { metadata } = useFoodCatalog();
  const { colors, spacing, typography } = useTheme();
  const citation = buildUsdaCitation(seedManifest);
  return (
    <SettingsShell title="About & data sources" intro="Nutrition Tracker uses a bundled, offline-first food catalog.">
      <Card style={{ gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>USDA FoodData Central</Text>
        <Text style={[typography.body, { color: colors.ink }]}>{citation}</Text>
        <Text style={[typography.caption, { color: colors.muted }]}>Source licenses and release details come from the bundled seed manifest.</Text>
      </Card>
      {metadata ? (
        <Card style={{ gap: spacing.xs }}>
          <Text style={[typography.bodyStrong, { color: colors.ink }]}>Bundled catalog</Text>
          <Text style={[typography.body, { color: colors.ink }]}>Seed: {metadata.seedVersion ?? 'unknown'}</Text>
          <Text style={[typography.body, { color: colors.ink }]}>Foods: {metadata.foodCount}</Text>
        </Card>
      ) : null}
    </SettingsShell>
  );
}
