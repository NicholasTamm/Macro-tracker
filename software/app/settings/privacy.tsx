import { Text } from 'react-native';
import { Card, useTheme } from '@/design-system';
import { SettingsShell } from './SettingsShell';

export default function PrivacyScreen() {
  const { colors, spacing, typography } = useTheme();
  return (
    <SettingsShell title="Privacy" intro="Placeholder pending legal review">
      <Card style={{ gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.danger }]}>This is a product placeholder, not a final privacy notice.</Text>
        <Text style={[typography.body, { color: colors.ink }]}>In Milestone 1, your data stays on this device. There is no account and no analytics. You can export your data from Settings.</Text>
        <Text style={[typography.caption, { color: colors.muted }]}>Final wording and disclosures are pending legal review.</Text>
      </Card>
    </SettingsShell>
  );
}
