import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system';
import type { ChartPoint } from './weightSeries';

const CHART_HEIGHT = 140;
const DOT = 10;

/**
 * Lightweight 30-day weight chart (plain Views — no chart deps).
 * The whole chart is a single accessible image whose label is the textual summary;
 * individual dots are hidden from assistive tech.
 */
export function WeightChart({
  points,
  summaryText,
  minLabel,
  maxLabel,
}: {
  points: ChartPoint[];
  summaryText: string;
  minLabel?: string;
  maxLabel?: string;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Weight chart, last 30 days. ${summaryText}`}
      style={{ gap: spacing.xs }}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.plot,
          {
            height: CHART_HEIGHT,
            backgroundColor: colors.band,
            borderRadius: radius.sm,
            borderColor: colors.divider,
          },
        ]}
      >
        {points.map((p) => (
          <View
            key={p.id}
            style={[
              styles.dot,
              {
                backgroundColor: colors.weightTrend,
                start: `${p.x * 100}%`,
                bottom: p.y * (CHART_HEIGHT - DOT * 2) + DOT / 2,
                marginStart: -DOT / 2,
              },
            ]}
          />
        ))}
      </View>
      {minLabel && maxLabel ? (
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={styles.axis}
        >
          <Text style={[typography.caption, { color: colors.muted }]}>30 days ago</Text>
          <Text style={[typography.caption, { color: colors.muted }]}>
            {minLabel} – {maxLabel}
          </Text>
          <Text style={[typography.caption, { color: colors.muted }]}>Today</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
