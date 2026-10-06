import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PrimaryButton,
  useTheme,
} from '@/design-system';
import { useUserData } from '@/components/UserDataProvider';
import {
  createWeightSample,
  listWeightSamples,
  tombstoneWeightSample,
  updateWeightSample,
  type WeightSample,
} from '@/modules/app-core/user-data';
import {
  chartPoints,
  formatWeight,
  parseWeightInput,
  summarizeWeights,
  toDisplayWeight,
  weightSummaryText,
  windowSamples,
} from '@/modules/app-core/weight';
import { WeightChart } from '@/modules/app-core/weight/WeightChart';

function formatSampleDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** M1-17 — Weight log + 30-day chart (Analytics tab). */
export default function Analytics() {
  const { colors, spacing, typography, radius } = useTheme();
  const { ready, error: dbError, db, snapshot, refresh } = useUserData();
  const unit = snapshot?.profile.massUnit ?? 'kg';

  const [samples, setSamples] = useState<WeightSample[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState<WeightSample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!db) return;
    setNow(new Date());
    setSamples(listWeightSamples(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const windowed = useMemo(() => windowSamples(samples, now), [samples, now]);
  const summary = useMemo(() => summarizeWeights(windowed), [windowed]);
  const summaryText = useMemo(() => weightSummaryText(summary, unit), [summary, unit]);
  const points = useMemo(() => chartPoints(windowed, now), [windowed, now]);
  const newestFirst = useMemo(() => windowed.slice().reverse(), [windowed]);

  const resetForm = () => {
    setEditing(null);
    setInput('');
  };

  const onSubmit = () => {
    if (!db) return;
    const parsed = parseWeightInput(input, unit);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    try {
      if (editing) {
        // Unchanged display text → keep canonical kg as-is (no unit round-trip drift).
        const unchanged = toDisplayWeight(parsed.kilograms, unit) === toDisplayWeight(editing.kilograms, unit);
        if (!unchanged) updateWeightSample(db, editing.id, { kilograms: parsed.kilograms });
        setStatus(`Updated weight to ${formatWeight(parsed.kilograms, unit)}.`);
      } else {
        createWeightSample(db, { timestamp: new Date().toISOString(), kilograms: parsed.kilograms });
        setStatus(`Logged ${formatWeight(parsed.kilograms, unit)}.`);
      }
      setError(null);
      resetForm();
      refresh();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onEdit = (s: WeightSample) => {
    setEditing(s);
    setInput(String(toDisplayWeight(s.kilograms, unit)));
    setError(null);
    setStatus(null);
  };

  const onDelete = (s: WeightSample) => {
    if (!db) return;
    tombstoneWeightSample(db, s.id);
    if (editing?.id === s.id) resetForm();
    setStatus(`Deleted ${formatWeight(s.kilograms, unit)} from ${formatSampleDate(s.timestamp)}.`);
    refresh();
    reload();
  };

  if (!ready) return <LoadingState />;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text accessibilityRole="header" style={[typography.section, { color: colors.ink }]}>
          Weight
        </Text>
        {dbError ? <ErrorBanner title="Storage unavailable" message={dbError} /> : null}
        {error ? <ErrorBanner title="Check weight" message={error} /> : null}
        {status ? (
          <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.muted }]}>
            {status}
          </Text>
        ) : null}

        <Card elevated>
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>
              {editing ? `Edit weight from ${formatSampleDate(editing.timestamp)}` : 'Log weight'}
            </Text>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <TextInput
                accessibilityLabel={`Weight in ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
                value={input}
                onChangeText={setInput}
                keyboardType="decimal-pad"
                placeholder={unit === 'lb' ? 'e.g. 160.4' : 'e.g. 72.4'}
                placeholderTextColor={colors.muted}
                onSubmitEditing={onSubmit}
                style={[
                  typography.body,
                  styles.input,
                  {
                    minHeight: 44,
                    borderColor: colors.divider,
                    borderRadius: radius.control,
                    color: colors.ink,
                    backgroundColor: colors.raised,
                    paddingHorizontal: spacing.md,
                  },
                ]}
              />
              <Text style={[typography.body, { color: colors.muted }]}>{unit}</Text>
            </View>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <PrimaryButton
                label={editing ? 'Save changes' : 'Log weight'}
                onPress={onSubmit}
                disabled={!db}
              />
              {editing ? (
                <PrimaryButton label="Cancel edit" variant="secondary" onPress={resetForm} />
              ) : null}
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>Last 30 days</Text>
            {summary.state === 'empty' ? (
              <EmptyState title="No weights yet" message={summaryText} />
            ) : (
              <>
                <WeightChart
                  points={points}
                  summaryText={summaryText}
                  minLabel={summary.minKg != null ? formatWeight(summary.minKg, unit) : undefined}
                  maxLabel={summary.maxKg != null ? formatWeight(summary.maxKg, unit) : undefined}
                />
                <Text style={[typography.body, { color: colors.ink }]}>{summaryText}</Text>
              </>
            )}
          </View>
        </Card>

        {newestFirst.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text accessibilityRole="header" style={[typography.bodyStrong, { color: colors.ink }]}>
              Entries
            </Text>
            {newestFirst.map((s) => {
              const label = `${formatWeight(s.kilograms, unit)} on ${formatSampleDate(s.timestamp)}`;
              return (
                <View
                  key={s.id}
                  style={[
                    styles.row,
                    {
                      justifyContent: 'space-between',
                      borderBottomColor: colors.divider,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      paddingVertical: spacing.sm,
                      gap: spacing.sm,
                    },
                  ]}
                >
                  <Text accessibilityLabel={label} style={[typography.body, { color: colors.ink, flex: 1 }]}>
                    {formatWeight(s.kilograms, unit)} · {formatSampleDate(s.timestamp)}
                  </Text>
                  <PrimaryButton
                    compact
                    variant="secondary"
                    label="Edit"
                    accessibilityLabel={`Edit ${label}`}
                    onPress={() => onEdit(s)}
                  />
                  <PrimaryButton
                    compact
                    variant="destructive"
                    label="Delete"
                    accessibilityLabel={`Delete ${label}`}
                    onPress={() => onDelete(s)}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth },
});
