import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { PrimaryButton } from './PrimaryButton';

export type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Matches HTML `.empty-state` specimen. */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl, gap: spacing.md }]}>
      <View style={styles.graphic} accessibilityElementsHidden>
        <View style={[styles.circle, { backgroundColor: colors.control }]}>
          <Text style={{ fontSize: 20 }}>📋</Text>
        </View>
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
        <PrimaryButton label={actionLabel} onPress={onAction} compact />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  graphic: { height: 74, justifyContent: 'center', marginBottom: 4 },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
