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
  useReduceMotion,
  modalAnimationFor,
} from '@/design-system';
import type { FoodDetailModel } from './buildFoodDetail';
import { gramsUnitAvailable, unitChoiceFromSelection } from './buildFoodDetail';
import { computeLiveNutrients } from './computeLiveNutrients';
import { logFoodToDiary } from './logFoodEntry';
import {
  parseQuantityInput,
  quantityErrorMessage,
} from './parseQuantity';
import type { SqlExecutor } from '../../app-core/user-data';
import {
  ensureDefaultMealSlots,
  getRecentFood,
  isFavorite,
  listMealSlots,
  toggleFavorite,
  type FoodKind,
} from '../../app-core/user-data';
import {
  localDayKeyFromDate,
  localTimeHHMM,
  parseLocalTimeHHMM,
  timestampFromLocalDayAndTime,
} from '../dayKey';

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

function initialUnitSelection(model: FoodDetailModel): string {
  const gramsOk = gramsUnitAvailable(model);
  if (model.defaultUnit.kind === 'grams') {
    if (gramsOk) return 'grams';
    if (model.servings[0]) return String(model.servings[0].servingId);
    return 'grams';
  }
  return String(model.defaultUnit.servingId);
}

function nutrientOrNull(raw: number | null | undefined, round: 'kcal' | 'g'): number | null {
  if (raw == null || typeof raw !== 'number' || Number.isNaN(raw)) return null;
  if (round === 'kcal') return Math.round(raw);
  return Math.round(raw * 10) / 10;
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
  const reduceMotion = useReduceMotion();
  const [qtyText, setQtyText] = useState('1');
  const [unitSelection, setUnitSelection] = useState('grams');
  const [mealSlotId, setMealSlotId] = useState<string | null>(null);
  const [slots, setSlots] = useState<
    Array<{ id: string; name: string; defaultTime: string | null }>
  >([]);
  const [timeText, setTimeText] = useState(localTimeHHMM());
  const [logError, setLogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const showGrams = model ? gramsUnitAvailable(model) : false;

  useEffect(() => {
    if (!visible || !model) return;
    setTimeText(localTimeHHMM());
    setLogError(null);
    setSubmitting(false);

    let qty = String(model.suggestedQuantity);
    let unitSel = initialUnitSelection(model);
    if (db) {
      const kind: FoodKind = model.kind === 'seed' ? 'seed' : 'custom';
      setFavorited(isFavorite(db, kind, model.foodStableId));
      const recent = getRecentFood(db, kind, model.foodStableId);
      if (recent?.lastQuantity != null && recent.lastQuantity > 0) {
        qty = String(recent.lastQuantity);
      }
      if (recent?.lastUnit) {
        const lu = recent.lastUnit.toLowerCase();
        if (lu === 'g' || lu === 'grams' || lu === 'gram') {
          if (gramsUnitAvailable(model)) unitSel = 'grams';
        } else if (/^\d+$/.test(recent.lastUnit) && model.servings.some((s) => String(s.servingId) === recent.lastUnit)) {
          unitSel = recent.lastUnit;
        } else {
          const match = model.servings.find((s) => s.unit === recent.lastUnit);
          if (match) unitSel = String(match.servingId);
        }
      }
    } else {
      setFavorited(false);
    }
    setQtyText(qty);
    setUnitSelection(unitSel);
  }, [visible, model, db]);

  useEffect(() => {
    if (!visible || !db) {
      setSlots([]);
      return;
    }
    ensureDefaultMealSlots(db);
    const list = listMealSlots(db);
    setSlots(list.map((s) => ({ id: s.id, name: s.name, defaultTime: s.defaultTime })));
    let selectedId: string | null = null;
    if (initialMealSlotId) {
      selectedId = initialMealSlotId;
    } else if (list.length > 0) {
      selectedId = list[0].id;
    }
    setMealSlotId(selectedId);
    if (selectedId) {
      const selected = list.find((s) => s.id === selectedId);
      if (selected?.defaultTime) {
        setTimeText(selected.defaultTime);
      }
    }
  }, [visible, db, initialMealSlotId]);

  // If grams becomes unavailable while selected, fall back to first serving.
  useEffect(() => {
    if (!model) return;
    if (unitSelection === 'grams' && !gramsUnitAvailable(model) && model.servings[0]) {
      setUnitSelection(String(model.servings[0].servingId));
    }
  }, [model, unitSelection]);

  const qtyParsed = useMemo(() => parseQuantityInput(qtyText), [qtyText]);
  const timeParsed = useMemo(() => parseLocalTimeHHMM(timeText), [timeText]);
  const unit = useMemo(() => {
    if (!model) return null;
    return unitChoiceFromSelection(model, unitSelection);
  }, [model, unitSelection]);

  const preview = useMemo(() => {
    if (!model || !unit || !qtyParsed.ok) return null;
    return computeLiveNutrients(model, qtyParsed.value, unit);
  }, [model, unit, qtyParsed]);

  const localDayKey = localDayKeyFromDate();

  const canLog =
    !!model &&
    !!db &&
    !!unit &&
    qtyParsed.ok &&
    timeParsed.ok &&
    !!preview &&
    preview.ok &&
    !submitting;

  const onSelectMeal = (slotId: string) => {
    setMealSlotId(slotId);
    const slot = slots.find((s) => s.id === slotId);
    if (slot?.defaultTime) {
      setTimeText(slot.defaultTime);
    }
  };

  const onToggleFavorite = () => {
    if (!model || !db) return;
    const kind: FoodKind = model.kind === 'seed' ? 'seed' : 'custom';
    const result = toggleFavorite(db, {
      foodKind: kind,
      foodStableId: model.foodStableId,
      foodDisplayName: model.displayName,
      foodLicenseTag: model.licenseTag,
      foodBrand: model.brand,
    });
    setFavorited(result.favorited);
  };

  const onLog = () => {
    if (!model || !db || !unit || !qtyParsed.ok || !timeParsed.ok) return;
    setSubmitting(true);
    setLogError(null);
    let timestamp: string;
    try {
      timestamp = timestampFromLocalDayAndTime(localDayKey, timeText);
    } catch (e) {
      setSubmitting(false);
      setLogError(e instanceof Error ? e.message : String(e));
      return;
    }
    const result = logFoodToDiary(db, {
      model,
      quantity: qtyParsed.value,
      unit,
      mealSlotId,
      timestamp,
      localDayKey,
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
          calories: nutrientOrNull(preview.nutritionSnapshot.energy_kcal, 'kcal'),
          protein: nutrientOrNull(preview.nutritionSnapshot.protein, 'g'),
          fat: nutrientOrNull(preview.nutritionSnapshot.fat_total, 'g'),
          carbs: nutrientOrNull(preview.nutritionSnapshot.carbohydrate, 'g'),
        }
      : { calories: null, protein: null, fat: null, carbs: null };

  return (
    <Modal
      visible={visible && !!model}
      animationType={modalAnimationFor(reduceMotion)}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
            onPress={onToggleFavorite}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
          >
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>
              {favorited ? '★' : '☆'}
            </Text>
          </Pressable>
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
                {showGrams ? (
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
                ) : null}
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
                      onPress={() => onSelectMeal(slot.id)}
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
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.micro, { color: colors.muted, textTransform: 'uppercase' }]}>
                Time
              </Text>
              <TextInput
                accessibilityLabel="Meal time"
                keyboardType="numbers-and-punctuation"
                value={timeText}
                onChangeText={setTimeText}
                placeholder="HH:MM"
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
              {!timeParsed.ok ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[typography.caption, { color: colors.danger }]}
                >
                  Enter time as HH:MM (24-hour).
                </Text>
              ) : (
                <Text style={[typography.caption, { color: colors.muted }]}>
                  Logs to {localDayKey} at {timeText} (local)
                </Text>
              )}
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
