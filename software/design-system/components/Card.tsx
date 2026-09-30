import React from 'react';
import { View, StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export type CardProps = ViewProps & {
  /** Raised tile (metric-card) vs band panel. */
  elevated?: boolean;
  padded?: boolean;
};

/**
 * Matches HTML `.metric-card` / raised product specimen
 * (`background: var(--app-raised)`, `--radius-card`).
 */
export function Card({
  elevated = true,
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: elevated ? colors.raised : colors.band,
          borderRadius: radius.card,
          padding: padded ? spacing.md : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Alias used in backlog as RaisedTile. */
export function RaisedTile(props: CardProps) {
  return <Card elevated {...props} />;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  } satisfies ViewStyle,
});
