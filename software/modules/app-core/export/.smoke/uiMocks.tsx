import React from 'react';
import { View } from 'react-native';

export function Feather() {
  return null;
}

export const router = {
  push() {},
};

export function SafeAreaView({ children, ...props }: React.ComponentProps<typeof View>) {
  return <View {...props}>{children}</View>;
}

export function useTheme() {
  return {
    colors: {
      canvas: '#fff',
      ink: '#111',
      muted: '#555',
      band: '#eee',
      raised: '#fff',
      divider: '#ccc',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    typography: { body: {}, caption: {}, section: {} },
  };
}
