import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { FOOD_ICON_SOURCES, FALLBACK_FOOD_ICON, type FoodIconKey } from './foodIconAssets';

export type FoodIconProps = {
  icon?: FoodIconKey;
  /** Square size in px (32 in FoodRow, 24 in diary rows). */
  size?: number;
};

/**
 * Decorative Fluent Emoji Flat food icon (issue 121). Rendered through
 * expo-image so the same SVG shows on iOS, Android and web. Hidden from
 * screen readers — the row's text carries the meaning.
 */
export function FoodIcon({ icon = FALLBACK_FOOD_ICON, size = 32 }: FoodIconProps) {
  const source = FOOD_ICON_SOURCES[icon] ?? FOOD_ICON_SOURCES[FALLBACK_FOOD_ICON];
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Image
        source={source}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessible={false}
        aria-hidden
        testID={`food-icon-${icon}`}
      />
    </View>
  );
}
