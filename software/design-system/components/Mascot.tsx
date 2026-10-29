import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Mascot art by pose (issue 122). Today these are hand-written placeholder
 * SVGs; final art (issue 127) replaces the files with the same names, so this
 * map and the Mascot API do not change. See assets/mascot/README.md.
 */
export const MASCOT_SOURCES = {
  wave: require('../../assets/mascot/placeholder-wave.svg'),
  think: require('../../assets/mascot/placeholder-think.svg'),
  cheer: require('../../assets/mascot/placeholder-cheer.svg'),
  sleep: require('../../assets/mascot/placeholder-sleep.svg'),
  scale: require('../../assets/mascot/placeholder-scale.svg'),
  emptyPlate: require('../../assets/mascot/placeholder-empty-plate.svg'),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type MascotPose = keyof typeof MASCOT_SOURCES;

export const MASCOT_POSES = Object.keys(MASCOT_SOURCES) as MascotPose[];

export type MascotProps = {
  pose: MascotPose;
  /** Square size in px. Default 96. */
  size?: number;
};

/**
 * Decorative companion illustration. Hidden from screen readers: the copy
 * next to it carries the meaning (gentle-companion fence rule: art zones only,
 * never inside data zones).
 */
export function Mascot({ pose, size = 96 }: MascotProps) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
      testID={`mascot-${pose}`}
    >
      <Image
        source={MASCOT_SOURCES[pose]}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessible={false}
        aria-hidden
      />
    </View>
  );
}
