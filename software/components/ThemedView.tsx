import type { ReactNode } from 'react';
import { View, useColorScheme, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import colors from './color';

type ThemedViewProps = ViewProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const ThemedView = ({ style, children, ...props }: ThemedViewProps) => {
  const colorScheme = useColorScheme();
  const theme = colors[colorScheme === 'dark' ? 'darkTheme' : 'lightTheme'];
  return (
    <View style={[{ backgroundColor: theme.colors.background }, style]} {...props}>
      {children}
    </View>
  );
};

export default ThemedView;
