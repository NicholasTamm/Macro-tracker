import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserData } from '@/components/UserDataProvider';
import { buildUserDataExportFiles } from '@/modules/app-core/export';
import { shareExportViaPlatform } from '@/modules/app-core/export/shareExport';
import { useTheme } from '@/design-system';

type FeatherName = ComponentProps<typeof Feather>['name'];

export default function Settings() {
  const { db, ready, snapshot } = useUserData();
  const { colors, spacing, typography } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const onExport = async () => {
    if (!db) {
      setExportMessage('User data not ready.');
      return;
    }
    setExporting(true);
    setExportMessage(null);
    try {
      const files = buildUserDataExportFiles(db);
      const result = await shareExportViaPlatform(files);
      setExportMessage(result.ok
        ? `Shared export: ${files.suggestedJsonName} and ${files.suggestedCsvName}.`
        : result.reason);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const profile = snapshot?.profile;
  const profileSummary = profile
    ? [profile.sex, profile.birthYear].filter(Boolean).join(' · ') || 'Local profile'
    : 'Local profile';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.xl }}>
        <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
          <Text accessibilityRole="header" style={[typography.section, { color: colors.ink }]}>Settings</Text>
          <Text style={[typography.body, { color: colors.muted, marginTop: spacing.xs }]}>{profileSummary}</Text>
        </View>
        <SettingsRow label="Profile" icon="user" onPress={() => router.push('/settings/profile')} />
        <SettingsRow label="Units & appearance" icon="sliders" onPress={() => router.push('/settings/units')} />
        <SettingsRow label="About & data sources" icon="info" onPress={() => router.push('/settings/about')} />
        <SettingsRow label="Open-source licenses" icon="file-text" onPress={() => router.push('/settings/licenses')} />
        <SettingsRow label="Privacy" icon="shield" onPress={() => router.push('/settings/privacy')} />
        <SettingsRow
          label={exporting ? 'Exporting…' : 'Export data (CSV + JSON)'}
          icon="download"
          onPress={ready && !exporting ? onExport : undefined}
          disabled={!ready || exporting}
        />
        {exporting ? <ActivityIndicator style={{ marginVertical: spacing.sm }} color={colors.ink} /> : null}
        {exportMessage ? (
          <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.muted, paddingHorizontal: spacing.xl, marginTop: spacing.sm }]}>
            {exportMessage}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ label, icon, onPress, disabled = false }: { label: string; icon: FeatherName; onPress?: () => void; disabled?: boolean }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
        backgroundColor: pressed ? colors.band : colors.raised,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Feather name={icon} size={22} color={colors.ink} />
      <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>{label}</Text>
      <Feather name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}
