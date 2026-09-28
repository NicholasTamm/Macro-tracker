import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

/** Matches HTML `.loading-state` / `.skeleton` (static, Reduce-Motion friendly). */
export function LoadingState() {
  const { colors, spacing, radius } = useTheme();
  const bar = (widthPct: `${number}%` | number, height: number) => (
    <View
      style={{
        width: widthPct,
        height,
        borderRadius: radius.sm,
        backgroundColor: colors.control,
      }}
    />
  );

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ gap: spacing.md, padding: spacing.lg }}
    >
      {bar('45%', 20)}
      {bar('65%', 11)}
      {bar('100%', 88)}
      <View style={styles.row}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.control,
          }}
        />
        <View style={{ flex: 1, gap: 7 }}>
          {bar('100%', 10)}
          {bar('50%', 10)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
});
