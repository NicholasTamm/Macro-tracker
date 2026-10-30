import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { FoodIcon } from './FoodIcon';
import type { FoodIconKey } from './foodIconAssets';

export type FoodRowProps = {
  name: string;
  detail: string;
  /** Fluent food icon key (see modules/food-catalog/foodIcon.ts). Defaults to the bowl. */
  icon?: FoodIconKey;
  /** @deprecated gallery-only override; rows render `icon` unless this is set. */
  emoji?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Matches HTML `.food-row` (icon | copy | add/edit control). Issue 121: a
 * decorative Fluent food icon replaces the system emoji.
 */
export function FoodRow({
  name,
  detail,
  icon,
  emoji,
  actionLabel = 'Add',
  onAction,
}: FoodRowProps) {
  const { colors, spacing, typography, font, radius } = useTheme();

  return (
    <View
      accessibilityLabel={`${name}. ${detail}`}
      style={[
        styles.row,
        {
          minHeight: 58,
          paddingVertical: 7,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.raised,
          borderBottomColor: colors.divider,
          gap: 9,
        },
      ]}
    >
      <View style={styles.icon}>
        {emoji ? (
          <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
            {emoji}
          </Text>
        ) : (
          <FoodIcon icon={icon} size={32} />
        )}
      </View>
      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[typography.foodName, { color: colors.ink }]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[typography.metadata, { color: colors.muted, marginTop: 2 }]}
        >
          {detail}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${name}`}
        hitSlop={8}
        onPress={onAction}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: colors.control,
            borderRadius: radius.pill,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={{ color: colors.ink, fontSize: 17, ...font('600') }}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 34, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, textAlign: 'center' },
  copy: { flex: 1, minWidth: 0 },
  action: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
