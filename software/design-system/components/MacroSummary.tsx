import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';

export type MacroTotals = {
  /** Null means unknown / unavailable — never display as zero. */
  calories: number | null;
  calorieGoal?: number;
  protein: number | null;
  proteinGoal?: number;
  fat: number | null;
  fatGoal?: number;
  carbs: number | null;
  carbsGoal?: number;
};

type Row = {
  key: keyof Pick<MacroTotals, 'calories' | 'protein' | 'fat' | 'carbs'>;
  label: string;
  unit: string;
  colorKey: 'energy' | 'protein' | 'fat' | 'carbs';
};

const ROWS: Row[] = [
  { key: 'calories', label: 'Calories', unit: '', colorKey: 'energy' },
  { key: 'protein', label: 'Protein', unit: 'g', colorKey: 'protein' },
  { key: 'fat', label: 'Fat', unit: 'g', colorKey: 'fat' },
  { key: 'carbs', label: 'Carbs', unit: 'g', colorKey: 'carbs' },
];

function formatMacroValue(value: number | null, unit: string): string {
  if (value == null) return '—';
  return `${value}${unit}`;
}

function a11yValue(label: string, value: number | null, unit: string): string {
  if (value == null) return `unknown ${label.toLowerCase()}`;
  if (unit === 'g') return `${value} grams ${label.toLowerCase()}`;
  return `${value} ${label.toLowerCase()}`;
}

/**
 * Matches HTML `.summary-chips` / `.timeline-summary` macro strip.
 * Null nutrients render as an em dash — never coerce missing to zero.
 */
export function MacroSummary({ totals }: { totals: MacroTotals }) {
  const { colors, spacing, typography } = useTheme();

  const a11y = [
    a11yValue('Calories', totals.calories, ''),
    a11yValue('Protein', totals.protein, 'g'),
    a11yValue('Fat', totals.fat, 'g'),
    a11yValue('Carbs', totals.carbs, 'g'),
  ].join(', ');

  return (
    <Card
      accessibilityRole="text"
      accessibilityLabel={`Daily macros: ${a11y}`}
      style={styles.wrap}
    >
      <View style={styles.row}>
        {ROWS.map((row, index) => {
          const value = totals[row.key];
          const goalKey = `${row.key === 'calories' ? 'calorie' : row.key}Goal` as
            | 'calorieGoal'
            | 'proteinGoal'
            | 'fatGoal'
            | 'carbsGoal';
          const goal = totals[goalKey];
          const accent = colors[row.colorKey];
          return (
            <View
              key={row.key}
              style={[
                styles.cell,
                {
                  borderEndWidth: index < ROWS.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderEndColor: colors.divider,
                  borderBottomColor: accent,
                  borderBottomWidth: 3,
                  paddingBottom: spacing.xs,
                  paddingHorizontal: spacing.sm,
                },
              ]}
            >
              <View style={styles.labelRow}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text style={[typography.micro, { color: colors.muted }]}>
                  {row.label}
                </Text>
              </View>
              <Text style={[typography.bodyStrong, { color: colors.ink }]}>
                {formatMacroValue(value, row.unit)}
                {goal != null ? (
                  <Text style={{ color: colors.muted, fontWeight: '500' }}>
                    {` / ${goal}${row.unit}`}
                  </Text>
                ) : null}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
