/**
 * Custom-food create/edit/archive sheet (M1-15).
 * Editing macros must not rewrite historical diary nutrition snapshots
 * (persistence updates custom_food only).
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PrimaryButton,
  ErrorBanner,
  useTheme,
  useReduceMotion,
  modalAnimationFor,
} from '@/design-system';
import type { CustomFood, SqlExecutor } from '../../app-core/user-data';
import {
  archiveCustomFoodSafe,
  saveCustomFoodCreate,
  saveCustomFoodEdit,
} from './saveCustomFood';
import type { CustomFoodDraft } from './validateDraft';

export type CustomFoodEditorSheetProps = {
  visible: boolean;
  db: SqlExecutor | null;
  /** null → create mode; set → edit/archive */
  food: CustomFood | null;
  onClose: () => void;
  onSaved: (foodId: string) => void;
};

function draftFromFood(food: CustomFood | null): CustomFoodDraft {
  if (!food) {
    return {
      name: '',
      brand: '',
      barcodeRaw: '',
      basisKind: 'mass',
      basisAmountText: '100',
      basisUnit: 'g',
      gramWeightText: '100',
      energyKcalText: '',
      proteinText: '',
      carbohydrateText: '',
      fatTotalText: '',
      optionalNutrients: { fiber: '', sodium: '', sugar: '' },
    };
  }
  const n = food.nutrients;
  const opt: Record<string, string> = {};
  for (const key of ['fiber', 'sodium', 'sugar'] as const) {
    if (!Object.prototype.hasOwnProperty.call(n, key) || n[key] === null) {
      opt[key] = '';
    } else {
      opt[key] = String(n[key]);
    }
  }
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcodeRaw: food.barcodeGtin14 ?? '',
    basisKind: food.basisKind,
    basisAmountText: String(food.basisAmount),
    basisUnit: food.basisUnit,
    gramWeightText:
      food.gramWeightForBasis != null ? String(food.gramWeightForBasis) : '',
    energyKcalText: n.energy_kcal != null ? String(n.energy_kcal) : '',
    proteinText: n.protein != null ? String(n.protein) : '',
    carbohydrateText: n.carbohydrate != null ? String(n.carbohydrate) : '',
    fatTotalText: n.fat_total != null ? String(n.fat_total) : '',
    optionalNutrients: opt,
  };
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  placeholder,
  a11yLabel,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  placeholder?: string;
  a11yLabel?: string;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.micro, { color: colors.muted, marginBottom: 4 }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={a11yLabel ?? label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
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
    </View>
  );
}

export function CustomFoodEditorSheet({
  visible,
  db,
  food,
  onClose,
  onSaved,
}: CustomFoodEditorSheetProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const reduceMotion = useReduceMotion();
  const isEdit = food != null;
  const [draft, setDraft] = useState<CustomFoodDraft>(() => draftFromFood(food));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(draftFromFood(food));
    setError(null);
    setSubmitting(false);
  }, [visible, food]);

  const patch = (partial: Partial<CustomFoodDraft>) =>
    setDraft((d) => ({ ...d, ...partial }));

  const onSave = () => {
    if (!db) {
      setError('User data unavailable.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = isEdit
      ? saveCustomFoodEdit(db, food.id, draft)
      : saveCustomFoodCreate(db, draft);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onSaved(result.food.id);
  };

  const onArchive = () => {
    if (!db || !food) return;
    setSubmitting(true);
    setError(null);
    const result = archiveCustomFoodSafe(db, food.id);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onSaved(result.food.id);
  };

  return (
    <Modal visible={visible} animationType={modalAnimationFor(reduceMotion)} onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: spacing.md,
              borderBottomColor: colors.divider,
            },
          ]}
        >
          <Text style={[typography.section, { color: colors.ink, flex: 1 }]}>
            {isEdit ? 'Edit custom food' : 'Create custom food'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close custom food editor"
            onPress={onClose}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
          >
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={{ marginBottom: spacing.sm }}>
              <ErrorBanner
                title="Cannot save"
                message={error}
                tone="error"
                actionLabel="Dismiss"
                onAction={() => setError(null)}
              />
            </View>
          ) : null}

          <Text style={[typography.micro, { color: colors.muted, marginBottom: spacing.sm }]}>
            Macros are required (use 0 for none). Leave optional nutrients blank for missing —
            blank is not the same as zero.
          </Text>

          <Field label="Name *" value={draft.name} onChangeText={(t) => patch({ name: t })} />
          <Field label="Brand" value={draft.brand} onChangeText={(t) => patch({ brand: t })} />
          <Field
            label="Barcode (UPC/EAN/GTIN)"
            value={draft.barcodeRaw}
            onChangeText={(t) => patch({ barcodeRaw: t })}
            keyboardType="number-pad"
            placeholder="Optional — validated, not scanned"
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Basis amount *"
                value={draft.basisAmountText}
                onChangeText={(t) => patch({ basisAmountText: t })}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Basis unit *"
                value={draft.basisUnit}
                onChangeText={(t) => patch({ basisUnit: t })}
              />
            </View>
          </View>
          <Field
            label="Gram weight for basis"
            value={draft.gramWeightText}
            onChangeText={(t) => patch({ gramWeightText: t })}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />

          <Text
            style={[
              typography.micro,
              {
                color: colors.muted,
                marginTop: spacing.sm,
                marginBottom: spacing.xs,
                textTransform: 'uppercase',
              },
            ]}
          >
            Macros (per basis)
          </Text>
          <Field
            label="Energy (kcal) *"
            value={draft.energyKcalText}
            onChangeText={(t) => patch({ energyKcalText: t })}
            keyboardType="decimal-pad"
          />
          <Field
            label="Protein (g) *"
            value={draft.proteinText}
            onChangeText={(t) => patch({ proteinText: t })}
            keyboardType="decimal-pad"
          />
          <Field
            label="Carbohydrate (g) *"
            value={draft.carbohydrateText}
            onChangeText={(t) => patch({ carbohydrateText: t })}
            keyboardType="decimal-pad"
          />
          <Field
            label="Fat (g) *"
            value={draft.fatTotalText}
            onChangeText={(t) => patch({ fatTotalText: t })}
            keyboardType="decimal-pad"
          />

          <Text
            style={[
              typography.micro,
              {
                color: colors.muted,
                marginTop: spacing.sm,
                marginBottom: spacing.xs,
                textTransform: 'uppercase',
              },
            ]}
          >
            Optional nutrients (blank = missing)
          </Text>
          {(['fiber', 'sodium', 'sugar'] as const).map((key) => (
            <Field
              key={key}
              label={key}
              value={draft.optionalNutrients[key] ?? ''}
              onChangeText={(t) =>
                patch({
                  optionalNutrients: { ...draft.optionalNutrients, [key]: t },
                })
              }
              keyboardType="decimal-pad"
              placeholder="Leave blank if unknown"
            />
          ))}

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <PrimaryButton
              label={submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create food'}
              onPress={onSave}
              disabled={submitting}
              accessibilityLabel={isEdit ? 'Save custom food changes' : 'Create custom food'}
            />
            {isEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Archive custom food"
                onPress={onArchive}
                disabled={submitting || food.isArchived}
                style={({ pressed }) => [
                  {
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.card,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.divider,
                    opacity: pressed || food.isArchived ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[typography.bodyStrong, { color: colors.ink }]}>
                  {food.isArchived ? 'Already archived' : 'Archive'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
