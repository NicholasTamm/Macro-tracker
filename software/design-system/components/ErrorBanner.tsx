import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export type BannerTone = 'error' | 'info' | 'success' | 'warning' | 'education' | 'neutral';

export type ErrorBannerProps = {
  title: string;
  message?: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

/**
 * Matches HTML `.banner` (education / neutral / info / warning / success).
 * `tone="error"` is the product ErrorBanner used for blocking faults.
 * All fills/accents come from named design-system tokens (M1-31 / #80).
 */
export function ErrorBanner({
  title,
  message,
  tone = 'error',
  actionLabel,
  onAction,
  onDismiss,
}: ErrorBannerProps) {
  const { colors, spacing, typography } = useTheme();

  const bg =
    tone === 'education'
      ? colors.education
      : tone === 'neutral'
        ? colors.band
        : tone === 'info'
          ? colors.infoFill
          : tone === 'success'
            ? colors.successFill
            : tone === 'warning'
              ? colors.warningFill
              : colors.dangerFill;

  const accent =
    tone === 'education'
      ? colors.educationInk
      : tone === 'error'
        ? colors.danger
        : tone === 'info'
          ? colors.energy
          : tone === 'success'
            ? colors.carbs
            : tone === 'warning'
              ? colors.warningInk
              : colors.ink;

  const textColor = tone === 'education' ? colors.educationInk : colors.ink;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.row,
        {
          minHeight: 64,
          paddingVertical: spacing.md,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: bg,
          gap: 13,
        },
      ]}
    >
      <View style={[styles.icon, { borderColor: accent }]}>
        <Text style={{ color: textColor, fontWeight: '800', fontSize: 9 }}>
          {tone === 'error' ? '!' : tone === 'success' ? '✓' : '●'}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.bodyStrong, { color: textColor, fontSize: 12 }]}>
          {title}
        </Text>
        {message ? (
          <Text style={[typography.caption, { color: textColor, marginTop: 2 }]}>
            {message}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            hitSlop={8}
            style={styles.hitTarget}
          >
            <Text style={{ color: textColor, fontSize: 11, fontWeight: '700' }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            hitSlop={8}
            style={styles.hitTarget}
          >
            <Text style={{ color: textColor, fontSize: 16 }}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hitTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
