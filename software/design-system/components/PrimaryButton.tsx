import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type PrimaryButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  compact?: boolean;
};

/**
 * Matches HTML `.button.primary` / `.secondary` / `.destructive`
 * (pill radius, ink-on-raised inverse primary).
 */
export function PrimaryButton({
  label,
  variant = 'primary',
  compact = false,
  disabled,
  style,
  ...rest
}: PrimaryButtonProps) {
  const { colors, radius, typography, spacing } = useTheme();

  const bg =
    variant === 'primary'
      ? colors.ink
      : variant === 'destructive'
        ? colors.control
        : colors.raised;
  const fg =
    variant === 'primary'
      ? colors.raised
      : variant === 'destructive'
        ? colors.danger
        : colors.ink;
  const borderColor = variant === 'secondary' ? colors.divider : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          minHeight: compact ? 36 : 42,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderColor,
          opacity: disabled ? 0.35 : state.pressed ? 0.88 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={[typography.button, { color: fg, fontSize: compact ? 12 : 15 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  } satisfies ViewStyle,
});
