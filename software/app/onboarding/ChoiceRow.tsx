import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  hint?: string;
};

export function ChoiceRow({ label, selected, onPress, hint }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.row,
        {
          minHeight: 44,
          padding: spacing.md,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: selected ? colors.ink : colors.controlBorder,
          backgroundColor: selected ? colors.band : colors.raised,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.ink, fontWeight: selected ? '600' : '400' }]}>
          {label}
        </Text>
        {hint ? (
          <Text style={[typography.caption, { color: colors.muted, marginTop: 2 }]}>{hint}</Text>
        ) : null}
      </View>
      <Text style={{ color: colors.ink }}>{selected ? '●' : '○'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
