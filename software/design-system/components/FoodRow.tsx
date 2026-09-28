import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export type FoodRowProps = {
  name: string;
  detail: string;
  emoji?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Matches HTML `.food-row` (emoji | copy | add/edit control).
 */
export function FoodRow({
  name,
  detail,
  emoji = '🍽️',
  actionLabel = 'Add',
  onAction,
}: FoodRowProps) {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <View
      accessibilityRole="button"
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
      <Text style={styles.emoji} accessibilityElementsHidden>
        {emoji}
      </Text>
      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[typography.bodyStrong, { color: colors.ink }]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[typography.micro, { color: colors.muted, marginTop: 2 }]}
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
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>＋</Text>
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
  emoji: { width: 34, fontSize: 24, textAlign: 'center' },
  copy: { flex: 1, minWidth: 0 },
  action: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
