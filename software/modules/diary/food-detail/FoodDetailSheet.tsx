/**
 * Food detail / log sheet UI (M1-13).
 * Modal over Search — does not implement edit/delete/undo (M1-14).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MacroSummary,
  PrimaryButton,
  ErrorBanner,
  useTheme,
} from '@/design-system';
import type { FoodDetailModel } from './buildFoodDetail';
import { unitChoiceFromSelection } from './buildFoodDetail';
import { computeLiveNutrients } from './computeLiveNutrients';
import { logFoodToDiary } from './logFoodEntry';
import {
  parseQuantityInput,
  quantityErrorMessage,
} from './parseQuantity';
import type { SqlExecutor } from '../../app-core/user-data';
import { ensureDefaultMealSlots, listMealSlots } from '../../app-core/user-data';
import { localDayKeyFromDate } from '../dayKey';

export type FoodDetailSheetProps = {
  visible: boolean;
  model: FoodDetailModel | null;
  db: SqlExecutor | null;
  /** Pre-select meal slot when opened from a Today slot (optional). */
  initialMealSlotId?: string | null;
  onClose: () => void;
  /** Called after a successful atomic log. */
  onLogged: (entryId: string) => void;
};

function servingLabel(unit: string, modifier?: string | null, qty?: number): string {
  const base = qty != null && qty !== 1 ? `${qty} ${unit}` : unit;
  const mod = modifier?.trim();
  return mod ? `${base} (${mod})` : base;
}

export function FoodDetailSheet({
  visible,
  model,
  db,
  initialMealSlotId = null,
  onClose,
  onLogged,
}: FoodDetailSheetProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const [qtyText, setQtyText] = useState('1');
  const [unitSelection, setUnitSelection] = useState('grams');
  const [mealSlotId, setMealSlotId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Array<{ id: string; name: string }>>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !model) return;
    setQtyText(String(model.suggestedQuantity));
    setUnitSelection(
      model.defaultUnit.kind === 'grams'
        ? 'grams'
        : String(model.defaultUnit.servingId),
    );
    setLogError(null);
    setSubmitting(false);
  }, [visible, model]);

  useEffect(() => {
    if (!visible || !db) {
      setSlots([]);
      return;
    }
    ensureDefaultMealSlots(db);
    const list = listMealSlots(db);
    setSlots(list.map((s) => ({ id: s.id, name: s.name })));
    if (initialMealSlotId) {
      setMealSlotId(initialMealSlotId);
    } else if (list.length > 0) {
      setMealSlotId(list[0].id);
    } else {
      setMealSlotId(null);
    }
  }, [visible, db, initialMealSlotId]);

  const qtyParsed = useMemo(() => parseQuantityInput(qtyText), [qtyText]);
  const unit = useMemo(() => {
    if (!model) return null;
    return unitChoiceFromSelection(model, unitSelection);
  }, [model, unitSelection]);

  const preview = useMemo(() => {
    if (!model || !unit || !qtyParsed.ok) return null;
    return computeLiveNutrients(model, qtyParsed.value, unit);
  }, [model, unit, qtyParsed]);

  const canLog =
    !!model &&
    !!db &&
    !!unit &&
    qtyParsed.ok &&
    !!preview &&
    preview.ok &&
    !submitting;

  const onLog = () => {
    if (!model || !db || !unit || !qtyParsed.ok) return;
    setSubmitting(true);
    setLogError(null);
    const result = logFoodToDiary(db, {
      model,
      quantity: qtyParsed.value,
      unit,
      mealSlotId,
      localDayKey: localDayKeyFromDate(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setLogError(result.reason);
      return;
    }
    onLogged(result.entry.id);
  };

  const macros =
    preview && preview.ok
      ? {
          calories: Math.round(Number(preview.nutritionSnapshot.energy_kcal ?? 0)),
          protein: Number(preview.nutritionSnapshot.protein ?? 0),
          fat: Number(preview.nutritionSnapshot.fat_total ?? 0),
          carbs: Number(preview.nutritionSnapshot.carbohydrate ?? 0),
        }
      : { calories: 0, protein: 0, fat: 0, carbs: 0 };

  return (
    <Modal
      visible={visible && !!model}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={['top', 'left', 'right', 'bottom']}>
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomColor: colors.divider,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close food detail"
            onPress={onClose}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
          >
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>Close</Text>
          </Pressable>
          <Text style={[typography.section, { color: colors.ink, flex: 1, textAlign: 'center' }]}>
            Log food
          </Text>
          <View style={{ minWidth: 44 }} />
        </View>

        {model ? (
          <ScrollView
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={`Food detail for ${model.displayName}`}
          >
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.display, { color: colors.ink }]}>{model.displayName}</Text>
              <Text style={[typography.caption, { color: colors.muted }]}>
                {model.sourceDisplayName}
                {model.brand ? ` · ${model.brand}` : ''}
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.micro, { color: colors.muted, textTransform: 'uppercase' }]}>
                Quantity
              </Text>
              <TextInput
                accessibilityLabel="Quantity"
                keyboardType="decimal-pad"
                value={qtyText}
                onChangeText={setQtyText}
                placeholder="1"
                placeholderTextColor={colors.muted}
                style={[
                  typography.body,
                  {
                    minHeight: 44,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.divider,
                    borderRadius: radius.card,
                    paddingHorizontal: spacing.md,
                    color: colors.ink,
                    backgroundColor: colors.raised,
                  },
                ]}
              />
              {!qtyParsed.ok ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[typography.caption, { color: colors.danger }]}
                >
                  {quantityErrorMessage(qtyParsed.reason)}
                </Text>
              ) : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.micro, { color: colors.muted, textTransform: 'uppercase' }]}>
                Unit
              </Text>
              <View style={styles.chipRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: unitSelection === 'grams' }}
                  accessibilityLabel="Unit grams"
                  onPress={() => setUnitSelection('grams')}
                  style={[
                    styles.chip,
                    {
                      minHeight: 44,
                      borderRadius: radius.pill,
                      backgroundColor:
                        unitSelection === 'grams' ? colors.ink : colors.control,
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.bodyStrong,
                      { color: unitSelection === 'grams' ? colors.raised : colors.ink },
                    ]}
                  >
                    Grams
                  </Text>
                </Pressable>
                {model.servings.map((s) => {
                  const id = String(s.servingId);
                  const selected = unitSelection === id;
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Unit ${servingLabel(s.unit, s.modifier, s.quantity)}`}
                      onPress={() => setUnitSelection(id)}
                      style={[
                        styles.chip,
                        {
                          minHeight: 44,
                          borderRadius: radius.pill,
                          backgroundColor: selected ? colors.ink : colors.control,
                          paddingHorizontal: spacing.md,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.bodyStrong,
                          { color: selected ? colors.raised : colors.ink },
                        ]}
                      >
                        {servingLabel(s.unit, s.modifier, s.quantity)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.micro, { color: colors.muted, textTransform: 'uppercase' }]}>
                Meal
              </Text>
              <View style={styles.chipRow}>
                {slots.map((slot) => {
                  const selected = mealSlotId === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Meal ${slot.name}`}
                      onPress={() => setMealSlotId(slot.id)}
                      style={[
                        styles.chip,
                        {
                          minHeight: 44,
                          borderRadius: radius.pill,
                          backgroundColor: selected ? colors.ink : colors.control,
                          paddingHorizontal: spacing.md,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.bodyStrong,
                          { color: selected ? colors.raised : colors.ink },
                        ]}
                      >
                        {slot.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[typography.caption, { color: colors.muted }]}>
                Logged at current time · {localDayKeyFromDate()}
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.micro, { color: colors.muted, textTransform: 'uppercase' }]}>
                Live nutrients
              </Text>
              {preview && !preview.ok ? (
                <ErrorBanner title="Cannot calculate" message={preview.reason} tone="error" />
              ) : (
                <MacroSummary totals={macros} />
              )}
              {preview && preview.ok && preview.grams != null ? (
                <Text style={[typography.micro, { color: colors.muted }]}>
                  {preview.grams.toFixed(1)} g · {preview.quantity} {preview.unitLabel}
                </Text>
              ) : null}
            </View>

            {logError ? (
              <ErrorBanner title="Log failed" message={logError} tone="error" />
            ) : null}

            <PrimaryButton
              label={submitting ? 'Logging…' : 'Log to Today'}
              disabled={!canLog}
              onPress={onLog}
            />
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', justifyContent: 'center' },
});
