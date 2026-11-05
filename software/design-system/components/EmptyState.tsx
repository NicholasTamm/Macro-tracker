import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { PrimaryButton, type PrimaryButtonProps } from './PrimaryButton';
import { Mascot, type MascotPose } from './Mascot';

export type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom decorative art for this empty state. */
  illustration?: React.ReactNode;
  /** Shorthand for `illustration={<Mascot pose={...} />}`. Ignored when `illustration` is set. */
  mascotPose?: MascotPose;
  /** CTA variant; gentle-companion empty states use `brand`. Default `primary`. */
  actionVariant?: PrimaryButtonProps['variant'];
};

/**
 * Matches HTML `.empty-state` specimen. Without an illustration or mascot
 * pose, render only the copy and optional action.
 */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  illustration,
  mascotPose,
  actionVariant = 'primary',
}: EmptyStateProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={message ? `${title}. ${message}` : title}
      style={[styles.wrap, { padding: spacing.xl, gap: spacing.md }]}
    >
      {illustration != null || mascotPose ? (
        <View
          style={styles.graphic}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {illustration ?? (mascotPose ? <Mascot pose={mascotPose} size={96} /> : null)}
        </View>
      ) : null}
      <Text style={[typography.section, { color: colors.ink, textAlign: 'center' }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} variant={actionVariant} compact />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  graphic: { minHeight: 74, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
});
