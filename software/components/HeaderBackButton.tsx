import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { I18nManager, Pressable } from 'react-native';
import { useState } from 'react';

type Props = {
  label: string;
  tintColor: string;
};

export function HeaderBackButton({ label, tintColor }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => router.back()}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        outlineColor: tintColor,
        outlineOffset: 2,
        outlineStyle: focused ? 'solid' : undefined,
        outlineWidth: focused ? 2 : 0,
      }}
    >
      <Feather
        name={I18nManager.isRTL ? 'chevron-right' : 'chevron-left'}
        size={28}
        color={tintColor}
      />
    </Pressable>
  );
}
