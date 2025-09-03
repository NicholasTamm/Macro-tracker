import { View, Text, StyleSheet, ScrollView } from 'react-native';

type DailyMacroSummary = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: Date;
}



export default function Journal({ dailyMacroSummary }: { dailyMacroSummary?: DailyMacroSummary }) {
  return (
    <ScrollView>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          {dailyMacroSummary?.date.toLocaleDateString() || 'Couldn\'t grab data'}
        </Text>
        <Text style={styles.text}>
          {`${dailyMacroSummary?.calories || 0} kcal`}
        </Text>
        <Text style={styles.text}>
          {`${dailyMacroSummary?.carbs || 0} g`}
        </Text>
        <Text style={styles.text}>
          {`${dailyMacroSummary?.fat || 0} g`}
        </Text>
        <Text style={styles.text}>
          {`${dailyMacroSummary?.protein || 0} g`}
        </Text>


      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
}); 