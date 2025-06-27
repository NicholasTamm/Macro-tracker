import { View, Text, useColorScheme } from "react-native";
import colors from "./color";

const ThemedView = ({ style, children, ...props }) => {
  const colorScheme = useColorScheme();
  const theme = colors[colorScheme === "dark" ? "darkTheme" : "lightTheme"];
  return (
    <View style={[{ backgroundColor: theme.colors.background }, style]} {...props}>
      {children}
    </View>
  );
};

export default ThemedView;
