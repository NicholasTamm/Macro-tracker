import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, PrimaryButton, useTheme } from '@/design-system';

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
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
}: Props) {
  const { colors, spacing, typography } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.canvas }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={[typography.section, { color: colors.ink }]} accessibilityRole="header">
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
