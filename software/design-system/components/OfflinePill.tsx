import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

/**
 * Compact offline indicator (M1-04 OfflinePill).
 */
export function OfflinePill({ label = 'Offline' }: { label?: string }) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.pill,
        {
          backgroundColor: colors.control,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          gap: 6,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.muted }]} />
      <Text style={[typography.caption, { color: colors.ink, fontWeight: '700' }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
