import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import {
  energyUnitForSpeech,
  formatEnergy,
} from '@/modules/app-core/settings/unitDisplay';
import type { EnergyUnit } from '@/modules/app-core/user-data/profileTypes';

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
  if (unit === 'kcal' || unit === 'kJ') return `${value} ${energyUnitForSpeech(unit)}`;
  return `${value} ${label.toLowerCase()}`;
}

/**
 * Matches HTML `.summary-chips` / `.timeline-summary` macro strip.
 * Null nutrients render as an em dash — never coerce missing to zero.
 */
export function MacroSummary({
  totals,
  energyUnit = 'kcal',
}: {
  totals: MacroTotals;
  energyUnit?: EnergyUnit;
}) {
  const { colors, spacing, typography } = useTheme();
  const energyValue = totals.calories == null ? null : Number(formatEnergy(totals.calories, energyUnit));

  const a11y = [
    a11yValue('Energy', energyValue, energyUnit),
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
          const isEnergy = row.key === 'calories';
          const label = isEnergy && energyUnit === 'kJ' ? 'Energy' : row.label;
          const unit = isEnergy ? ` ${energyUnit}` : row.unit;
          const displayValue = isEnergy && value != null
            ? Number(formatEnergy(value, energyUnit))
            : value;
          const displayGoal = isEnergy && goal != null
            ? Number(formatEnergy(goal, energyUnit))
            : goal;
          return (
            <View
              key={row.key}
              style={[
                styles.cell,
                {
                  borderRightWidth: index < ROWS.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderRightColor: colors.divider,
                  borderBottomColor: accent,
                  borderBottomWidth: 3,
                  paddingBottom: spacing.xs,
                  paddingHorizontal: spacing.sm,
                },
              ]}
            >
              <View style={styles.labelRow}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text
                  style={[typography.micro, { color: colors.muted }]}
                >
                  {label}
                </Text>
              </View>
              <Text
                style={[typography.bodyStrong, { color: colors.ink }]}
              >
                {formatMacroValue(displayValue, unit)}
                {displayGoal != null ? (
                  <Text
                    style={{ color: colors.muted, fontWeight: '500' }}
                  >
                    {` / ${displayGoal}${unit}`}
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
