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

/** Progress uses canonical values so display-unit rounding cannot change the state. */
export function macroProgress(consumed: number | null, target?: number) {
  if (consumed == null || !Number.isFinite(consumed) || consumed < 0
    || target == null || !Number.isFinite(target) || target <= 0) {
    return { fill: 0, percent: null, over: false };
  }
  const ratio = consumed / target;
  return { fill: Math.min(ratio, 1), percent: Math.round(ratio * 100), over: consumed > target };
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
  const { colors, spacing, typography, font } = useTheme();
  return (
    <Card style={styles.wrap}>
      <View style={styles.row}>
        {ROWS.map((row, index) => {
          const value = totals[row.key];
          const goalKey = `${row.key === 'calories' ? 'calorie' : row.key}Goal` as
            | 'calorieGoal'
            | 'proteinGoal'
            | 'fatGoal'
            | 'carbsGoal';
          const goal = totals[goalKey];
          const progress = macroProgress(value, goal);
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
          const targetLabel = displayGoal != null
            ? `, target ${displayGoal} ${isEnergy ? energyUnitForSpeech(energyUnit) : 'grams'}`
            : '';
          const progressLabel = progress.percent == null ? 'progress unavailable' : `${progress.percent}% of target`;
          return (
            <View
              key={row.key}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${a11yValue(label, displayValue, isEnergy ? energyUnit : row.unit)}${targetLabel}, ${progressLabel}${progress.over ? ', over target' : ''}`}
              style={[
                styles.cell,
                {
                  borderEndWidth: index < ROWS.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderEndColor: colors.divider,
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
                style={[typography.bodyStrong, { flex: 1, color: colors.ink, fontVariant: ['tabular-nums'] }]}
              >
                {formatMacroValue(displayValue, unit)}
                {displayGoal != null ? (
                  <Text
                    style={{
                      color: colors.muted,
                      ...font('500'),
                    }}
                  >
                    {` / ${displayGoal}${unit}`}
                  </Text>
                ) : null}
              </Text>
              {progress.over ? (
                <Text style={[typography.micro, { color: colors.ink }]}>Over target</Text>
              ) : null}
              <View
                style={[styles.track, {
                  backgroundColor: colors.control,
                  borderColor: colors.controlBorder,
                  marginTop: spacing.xs,
                }]}
              >
                <View style={[styles.fill, {
                  width: `${progress.fill * 100}%`,
                  backgroundColor: accent,
                  // A contrasting edge preserves the fill shape for pale nutrient colours.
                  borderColor: colors.ink,
                  borderWidth: progress.fill > 0 ? 1 : 0,
                }]} />
              </View>
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
  track: { height: 8, borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
