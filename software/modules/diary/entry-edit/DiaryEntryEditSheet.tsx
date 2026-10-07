/**
 * Modal to edit a diary entry quantity (M1-14).
 * Recalculates live preview from the immutable nutrition snapshot.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
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
import type { DiaryEntry, EnergyUnit } from '../../app-core/user-data';
import {
  parseQuantityInput,
  quantityErrorMessage,
} from '../food-detail/parseQuantity';
import { scaleSnapshotForQuantity } from './scaleSnapshotForQuantity';

export type DiaryEntryEditSheetProps = {
  visible: boolean;
  entry: DiaryEntry | null;
  energyUnit: EnergyUnit;
  onClose: () => void;
  onSave: (newQuantity: number) => void;
};

function nutrientOrNull(raw: number | null | undefined, round: 'kcal' | 'g'): number | null {
  if (raw == null || typeof raw !== 'number' || Number.isNaN(raw)) return null;
  if (round === 'kcal') return Math.round(raw);
  return Math.round(raw * 10) / 10;
}

export function DiaryEntryEditSheet({
  visible,
  entry,
  energyUnit,
  onClose,
  onSave,
}: DiaryEntryEditSheetProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const reduceMotion = useReduceMotion();
  const [qtyText, setQtyText] = useState('1');

  useEffect(() => {
    if (!visible || !entry) return;
    setQtyText(String(entry.quantity));
  }, [visible, entry]);

  const qtyParsed = useMemo(() => parseQuantityInput(qtyText), [qtyText]);

  const preview = useMemo(() => {
    if (!entry || !qtyParsed.ok) return null;
    try {
      return scaleSnapshotForQuantity(entry, qtyParsed.value);
    } catch {
      return null;
    }
  }, [entry, qtyParsed]);

  const macros =
    preview != null
      ? {
          calories: nutrientOrNull(preview.nutritionSnapshot.energy_kcal, 'kcal'),
          protein: nutrientOrNull(preview.nutritionSnapshot.protein, 'g'),
          fat: nutrientOrNull(preview.nutritionSnapshot.fat_total, 'g'),
          carbs: nutrientOrNull(preview.nutritionSnapshot.carbohydrate, 'g'),
        }
      : { calories: null, protein: null, fat: null, carbs: null };

  const canSave = !!entry && qtyParsed.ok && preview != null;

  return (
    <Modal
      visible={visible && !!entry}
      animationType={modalAnimationFor(reduceMotion)}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.canvas }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
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
            accessibilityLabel="Close edit entry"
            onPress={onClose}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
          >
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>Close</Text>
          </Pressable>
          <Text style={[typography.section, { color: colors.ink, flex: 1, textAlign: 'center' }]}>
            Edit quantity
          </Text>
          <View style={{ minWidth: 44 }} />
        </View>

        {entry ? (
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.display, { color: colors.ink }]}>
                {entry.foodDisplayName}
              </Text>
              <Text style={[typography.caption, { color: colors.muted }]}>
                {entry.unitLabel} · snapshot locked (seed/custom edits won't rewrite)
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.micro, { color: colors.muted, textTransform: 'uppercase' }]}>
                Quantity
              </Text>
              <TextInput
                accessibilityLabel="Edit quantity"
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
                Recalculated nutrients
              </Text>
              {preview == null && qtyParsed.ok ? (
                <ErrorBanner title="Cannot recalculate" message="Invalid snapshot scale." tone="error" />
              ) : (
                <MacroSummary totals={macros} energyUnit={energyUnit} />
              )}
              {preview?.grams != null ? (
                <Text style={[typography.micro, { color: colors.muted }]}>
                  {preview.grams.toFixed(1)} g · {preview.quantity} {entry.unitLabel}
                </Text>
              ) : null}
            </View>

            <PrimaryButton
              label="Save"
              disabled={!canSave}
              onPress={() => {
                if (!qtyParsed.ok) return;
                onSave(qtyParsed.value);
              }}
            />
          </View>
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
});
