import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system';

export function SettingsShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.section, { color: colors.ink }]}>{title}</Text>
          {intro ? <Text style={[typography.body, { color: colors.muted }]}>{intro}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
