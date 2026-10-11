import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  hint?: string;
  mode?: 'radio' | 'checkbox';
};

export function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      {children}
    </View>
  );
}

export function ChoiceRow({ label, selected, onPress, hint, mode = 'radio' }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  // RN Web PressResponder only treats Space as a press for role=button; radios/checkboxes need explicit Space.
  const onKeyDown = (event: { key?: string; preventDefault?: () => void }) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault?.();
      onPress();
    }
  };
  return (
    <Pressable
      accessibilityRole={mode}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // @ts-expect-error RN Web forwards onKeyDown; React Native PressableProps omits it
      onKeyDown={onKeyDown}
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
          outlineColor: colors.ink,
          outlineOffset: 2,
          outlineStyle: focused ? 'solid' : undefined,
          outlineWidth: focused ? 2 : 0,
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
