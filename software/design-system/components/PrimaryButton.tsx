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
  variant?: 'primary' | 'secondary' | 'destructive' | 'brand';
  compact?: boolean;
};

/**
 * Matches HTML `.button.primary` / `.secondary` / `.destructive`
 * (pill radius, ink-on-raised inverse primary).
 * `brand` (issue 119): brand-orange fill with dark `onBrand` label — never
 * white on orange. Reserve for Gentle companion CTAs (onboarding, empty states).
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

  // Issue 126: a disabled brand CTA swaps to the gated muted-on-control pair
  // at full opacity, so its label stays readable (not faded orange).
  const brandDisabled = variant === 'brand' && !!disabled;
  const bg = brandDisabled
    ? colors.control
    : variant === 'primary'
      ? colors.ink
      : variant === 'brand'
        ? colors.brand
        : variant === 'destructive'
          ? colors.control
          : colors.raised;
  const fg = brandDisabled
    ? colors.muted
    : variant === 'primary'
      ? colors.raised
      : variant === 'brand'
        ? colors.onBrand
        : variant === 'destructive'
          ? colors.danger
          : colors.ink;
  const borderColor = variant === 'secondary' ? colors.controlBorder : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          minHeight: compact ? 44 : 44,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderColor,
          opacity: brandDisabled ? 1 : disabled ? 0.35 : state.pressed ? 0.88 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text
        style={[typography.control, { color: fg, fontSize: compact ? 12 : 15 }]}
      >
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
