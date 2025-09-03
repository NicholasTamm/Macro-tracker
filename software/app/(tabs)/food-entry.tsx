import { TextInput, ScrollView, View, Text, StyleSheet } from 'react-native';
import * as React from "react"
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FoodEntry() {
  
  const [inputText, setSearchQuery] = React.useState("");
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  }
  return (
    <SafeAreaView style={styles.search_container}>
  
          <TextInput 
            placeholder ='Find Food...' 
            value={inputText}
            clearButtonMode="always" 
            placeholderTextColor="#888"
            style={styles.search_placeholder_content} 
            onChangeText={handleSearch}
          />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search_container:{
    flex:1,
    marginHorizontal: 28

  },
  search_placeholder_content:{
    paddingHorizontal:20,
    paddingVertical:10,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 32,
    fontWeight: "bold",
  },

}); 