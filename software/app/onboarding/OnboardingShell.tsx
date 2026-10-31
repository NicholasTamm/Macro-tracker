import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Mascot, PrimaryButton, useTheme, type MascotPose } from '@/design-system';

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Issue 126: decorative mascot above a display-type title (first and last steps only). */
  mascotPose?: MascotPose;
};

export function OnboardingShell({
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  mascotPose,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.canvas }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {mascotPose ? (
          <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <Mascot pose={mascotPose} size={120} />
          </View>
        ) : null}
        <Text
          style={[mascotPose ? typography.display : typography.section, { color: colors.ink }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.body, { color: colors.muted }]}>{subtitle}</Text>
        ) : null}
        <Card>{children}</Card>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <PrimaryButton
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            variant="brand"
          />
          {secondaryLabel && onSecondary ? (
            <PrimaryButton
              label={secondaryLabel}
              variant="secondary"
              onPress={onSecondary}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
