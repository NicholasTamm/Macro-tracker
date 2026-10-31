import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Mascot, useTheme } from '@/design-system';
import { useReduceMotion } from '@/design-system/theme/useReduceMotion';

/**
 * Compact goal-hit celebration (issue 125). Sits above the meal slots,
 * outside MacroSummary (art zone, not data zone). Animates in only when
 * Reduce Motion is known to be off; otherwise renders statically once known.
 */
export function GoalHitCard() {
  const { colors, spacing, typography } = useTheme();
  const reduceMotion = useReduceMotion();
  if (reduceMotion === null) return null;

  return (
    <Animated.View
      entering={reduceMotion === false ? FadeInDown.duration(260) : undefined}
      style={{ marginBottom: spacing.md }}
      testID="goal-hit-card"
    >
      <Card>
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel="You hit today's targets."
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Mascot pose="cheer" size={56} />
          <Text style={[typography.bodyStrong, { color: colors.ink, flex: 1 }]}>
            You hit today&apos;s targets. Nice, steady work.
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
}
