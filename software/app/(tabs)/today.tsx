import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MacroSummary,
  EmptyState,
  OfflinePill,
  Card,
  LoadingState,
  ErrorBanner,
  useTheme,
} from '@/design-system';
import { useUserData } from '@/components/UserDataProvider';
import {
  formatDayLabel,
  formatEntryTime,
  loadTodayDay,
  localDayKeyFromDate,
  shiftDayKey,
  type DiaryEntry,
  type TodayDayView,
} from '@/modules/diary';

function EntryRow({ entry }: { entry: DiaryEntry }) {
  const { colors, typography, spacing } = useTheme();
  const kcal = entry.nutritionSnapshot.energy_kcal;
  const kcalLabel =
    typeof kcal === 'number' && !Number.isNaN(kcal) ? `${Math.round(kcal)} kcal` : '— kcal';
  const detail = `${entry.quantity} ${entry.unitLabel} · ${kcalLabel} · ${formatEntryTime(entry.timestamp)}`;

  return (
    <View
      accessibilityLabel={`${entry.foodDisplayName}. ${detail}`}
      style={[
        styles.entryRow,
        {
          borderBottomColor: colors.divider,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
        },
      ]}
    >
      <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.ink, flex: 1 }]}>
        {entry.foodDisplayName}
      </Text>
      <Text numberOfLines={1} style={[typography.micro, { color: colors.muted }]}>
        {detail}
      </Text>
    </View>
  );
}

function MealSlotCard({
  title,
  entries,
  emptyHint,
}: {
  title: string;
  entries: DiaryEntry[];
  emptyHint: string;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Card padded={false} style={{ marginBottom: spacing.md }}>
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={[typography.section, { color: colors.ink }]}>{title}</Text>
        <Text style={[typography.caption, { color: colors.muted }]}>
          {entries.length === 0 ? 'Empty' : `${entries.length}`}
        </Text>
      </View>
      {entries.length === 0 ? (
        <Text
          style={[
            typography.caption,
            { color: colors.muted, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
          ]}
        >
          {emptyHint}
        </Text>
      ) : (
        entries.map((e) => <EntryRow key={e.id} entry={e} />)
      )}
    </Card>
  );
}

function DateSelector({
  dayKey,
  onChange,
}: {
  dayKey: string;
  onChange: (next: string) => void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const todayKey = localDayKeyFromDate();
  const label = formatDayLabel(dayKey, todayKey);

  const navBtn = (delta: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      onPress={() => onChange(shiftDayKey(dayKey, delta))}
      style={({ pressed }) => [
        styles.navBtn,
        {
          backgroundColor: colors.control,
          borderRadius: radius.pill,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>
        {delta < 0 ? '‹' : '›'}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.dateRow,
        { gap: spacing.sm, marginBottom: spacing.md, alignItems: 'center' },
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={`Selected day ${label}`}
    >
      {navBtn(-1, 'Previous day')}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={[typography.section, { color: colors.ink }]}>{label}</Text>
        <Text style={[typography.micro, { color: colors.muted }]}>{dayKey}</Text>
      </View>
      {navBtn(1, 'Next day')}
    </View>
  );
}

export default function TodayScreen() {
  const { ready, error, db, refresh } = useUserData();
  const { colors, spacing, typography } = useTheme();
  const [dayKey, setDayKey] = useState(() => localDayKeyFromDate());
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    refresh();
    setTick((t) => t + 1);
  }, [refresh]);

  // Reload when returning from Search / food detail log (atomic Today update).
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const view: TodayDayView | null = useMemo(() => {
    if (!db) return null;
    void tick;
    return loadTodayDay(db, dayKey);
  }, [db, dayKey, tick]);

  if (!ready) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.canvas }]}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (error || !db || !view) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.canvas, padding: spacing.md }]}>
        <ErrorBanner
          title={error ?? 'User data unavailable'}
          tone="error"
          actionLabel="Retry"
          onAction={reload}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.canvas }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        accessibilityLabel="Today diary"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
          }}
        >
          <Text style={[typography.display, { color: colors.ink }]}>Today</Text>
          <OfflinePill label="Offline" />
        </View>

        <DateSelector dayKey={dayKey} onChange={setDayKey} />

        <View style={{ marginBottom: spacing.md }}>
          <MacroSummary
            totals={{
              calories: view.totals.calories,
              protein: view.totals.protein,
              fat: view.totals.fat,
              carbs: view.totals.carbs,
              ...view.goals,
            }}
          />
        </View>

        {view.entryCount === 0 ? (
          <EmptyState
            title="No foods logged"
            message="This day is empty. Open Search, pick a food, and log it here offline."
          />
        ) : null}

        {view.slots.map((slot) => (
          <MealSlotCard
            key={slot.id}
            title={slot.name}
            entries={slot.entries}
            emptyHint="No entries in this slot yet."
          />
        ))}

        {view.unscheduled.length > 0 ? (
          <MealSlotCard
            title="Unscheduled"
            entries={view.unscheduled}
            emptyHint="No unscheduled entries."
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dateRow: { flexDirection: 'row' },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
