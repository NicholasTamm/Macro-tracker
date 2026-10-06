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
import { formatEnergy } from '@/modules/app-core/settings';
import type { EnergyUnit } from '@/modules/app-core/user-data';
import {
  formatDayLabel,
  formatEntryTime,
  loadTodayDay,
  localDayKeyFromDate,
  shiftDayKey,
  editDiaryEntryQuantity,
  deleteDiaryEntry,
  applyDiaryUndo,
  type DiaryEntry,
  type TodayDayView,
  type UndoAction,
} from '@/modules/diary';
import { DiaryEntryEditSheet } from '@/modules/diary/entry-edit/DiaryEntryEditSheet';

function EntryRow({
  entry,
  energyUnit,
  onEdit,
  onDelete,
}: {
  entry: DiaryEntry;
  energyUnit: EnergyUnit;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const kcal = entry.nutritionSnapshot.energy_kcal;
  const kcalLabel =
    typeof kcal === 'number' && !Number.isNaN(kcal)
      ? `${formatEnergy(kcal, energyUnit)} ${energyUnit}`
      : `— ${energyUnit}`;
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
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.ink }]}>
          {entry.foodDisplayName}
        </Text>
        <Text numberOfLines={1} style={[typography.micro, { color: colors.muted }]}>
          {detail}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${entry.foodDisplayName}`}
        hitSlop={8}
        onPress={() => onEdit(entry)}
        style={({ pressed }) => [
          styles.rowAction,
          {
            backgroundColor: colors.control,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[typography.caption, { color: colors.ink, fontWeight: '700' }]}>Edit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${entry.foodDisplayName}`}
        hitSlop={8}
        onPress={() => onDelete(entry)}
        style={({ pressed }) => [
          styles.rowAction,
          {
            backgroundColor: colors.control,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[typography.caption, { color: colors.danger, fontWeight: '700' }]}>Del</Text>
      </Pressable>
    </View>
  );
}

function MealSlotCard({
  title,
  entries,
  energyUnit,
  emptyHint,
  onEdit,
  onDelete,
}: {
  title: string;
  entries: DiaryEntry[];
  energyUnit: EnergyUnit;
  emptyHint: string;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
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
        entries.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            energyUnit={energyUnit}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
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
  const { ready, error, db, snapshot, refresh } = useUserData();
  const { colors, spacing, typography } = useTheme();
  const [dayKey, setDayKey] = useState(() => localDayKeyFromDate());
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const energyUnit = snapshot?.profile.energyUnit ?? 'kcal';

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

  const onEdit = useCallback((entry: DiaryEntry) => {
    setActionError(null);
    setEditing(entry);
  }, []);

  const onDelete = useCallback(
    (entry: DiaryEntry) => {
      if (!db) return;
      setActionError(null);
      const result = deleteDiaryEntry(db, entry.id);
      if (!result.ok) {
        setActionError(result.reason);
        return;
      }
      setUndo(result.undo);
      reload();
    },
    [db, reload],
  );

  const onSaveEdit = useCallback(
    (newQuantity: number) => {
      if (!db || !editing) return;
      const result = editDiaryEntryQuantity(db, editing.id, newQuantity);
      if (!result.ok) {
        setActionError(result.reason);
        return;
      }
      setUndo({
        kind: 'edit',
        entryId: editing.id,
        foodDisplayName: editing.foodDisplayName,
        previous: result.previous,
      });
      setEditing(null);
      setActionError(null);
      reload();
    },
    [db, editing, reload],
  );

  const onUndo = useCallback(() => {
    if (!db || !undo) return;
    const result = applyDiaryUndo(db, undo);
    if (!result.ok) {
      setActionError(result.reason);
      return;
    }
    setUndo(null);
    setActionError(null);
    reload();
  }, [db, undo, reload]);

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
            energyUnit={energyUnit}
            totals={{
              calories: view.totals.calories,
              protein: view.totals.protein,
              fat: view.totals.fat,
              carbs: view.totals.carbs,
              ...view.goals,
            }}
          />
        </View>

        {actionError ? (
          <View style={{ marginBottom: spacing.md }}>
            <ErrorBanner
              title="Action failed"
              message={actionError}
              tone="error"
              onDismiss={() => setActionError(null)}
            />
          </View>
        ) : null}

        {undo ? (
          <View style={{ marginBottom: spacing.md }}>
            <ErrorBanner
              title={
                undo.kind === 'delete'
                  ? `Deleted ${undo.foodDisplayName}`
                  : `Edited ${undo.foodDisplayName}`
              }
              message="Tap Undo to revert."
              tone="info"
              actionLabel="Undo"
              onAction={onUndo}
              onDismiss={() => setUndo(null)}
            />
          </View>
        ) : null}

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
            energyUnit={energyUnit}
            emptyHint="No entries in this slot yet."
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}

        {view.unscheduled.length > 0 ? (
          <MealSlotCard
            title="Unscheduled"
            entries={view.unscheduled}
            energyUnit={energyUnit}
            emptyHint="No unscheduled entries."
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : null}
      </ScrollView>

      <DiaryEntryEditSheet
        visible={!!editing}
        entry={editing}
        energyUnit={energyUnit}
        onClose={() => setEditing(null)}
        onSave={onSaveEdit}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowAction: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
