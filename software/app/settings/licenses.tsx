import { Text, View } from 'react-native';
import { Card, useTheme } from '@/design-system';
import { BUNDLED_LICENSES } from '@/modules/app-core/settings';
import { SettingsShell } from './SettingsShell';

export default function LicensesScreen() {
  const { colors, spacing, typography } = useTheme();
  return (
    <SettingsShell title="Open-source licenses" intro="Key open-source software bundled with this app.">
      <Card padded={false}>
        {BUNDLED_LICENSES.map((dependency, index) => (
          <View key={dependency.name} style={{ minHeight: 44, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: index === BUNDLED_LICENSES.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}>
            <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>{dependency.name}</Text>
            <Text style={[typography.bodyStrong, { color: colors.muted }]}>{dependency.license}</Text>
          </View>
        ))}
      </Card>
    </SettingsShell>
  );
}
