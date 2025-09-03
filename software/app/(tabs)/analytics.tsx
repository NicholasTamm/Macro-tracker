import { StyleSheet, Text, View } from "react-native";


export default function Analytics() {

  return (
    <View style={styles.container}>
      <Text style={styles.text}>analytics screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    fontSize: 20
  },
});