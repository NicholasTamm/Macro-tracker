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
  /** Custom decorative art in place of the neutral glyph (issue 122). */
  illustration?: React.ReactNode;
  /** Shorthand for `illustration={<Mascot pose={...} />}`. Ignored when `illustration` is set. */
  mascotPose?: MascotPose;
  /** CTA variant; gentle-companion empty states use `brand`. Default `primary`. */
  actionVariant?: PrimaryButtonProps['variant'];
};

/**
 * Matches HTML `.empty-state` specimen. With no `illustration` or
 * `mascotPose` it keeps the neutral glyph, so existing call sites are
 * unchanged until they migrate.
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
      <View
        style={styles.graphic}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {illustration ??
          (mascotPose ? (
            <Mascot pose={mascotPose} size={96} />
          ) : (
            <View style={[styles.circle, { backgroundColor: colors.control }]}>
              <Text style={{ fontSize: 20 }}>📋</Text>
            </View>
          ))}
      </View>
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
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
