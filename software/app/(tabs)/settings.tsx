import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { MaterialIcons, Feather, Ionicons } from "@expo/vector-icons";
import userIcon from "../../assets/images/userIcon.jpg";
import ThemedView from "../../components/ThemedView";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Settings() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >

      <View style={styles.profileSection}>
        <Image source={userIcon} style={styles.avatar} />
        <Text style={styles.name}>User Name</Text>
      </View>


        <ScrollView>
          <View style={styles.optionsSection}>
            <SettingsOption
              label="Profile"
              icon={<Feather name="user" size={22} color="#222" />}
            />
            <SettingsOption
              label="Goals"
              icon={<Feather name="target" size={22} color="#222" />}
            />
            <SettingsOption
              label="Notifications"
              icon={
                <Ionicons name="notifications-outline" size={22} color="#222" />
              }
            />
            <SettingsOption
              label="Help"
              icon={<Feather name="help-circle" size={22} color="#222" />}
            />
            <SettingsOption
              label="About"
              icon={<Feather name="info" size={22} color="#222" />}
            />
            <SettingsOption
              label="Log out"
              icon={<MaterialIcons name="logout" size={22} color="#d00" />}
              isDestructive
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SettingsOption({
  label,
  icon,
  isDestructive = false,
}: {
  label: string;
  icon: React.ReactNode;
  isDestructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.option}>

      <View style={styles.optionContent}>
        {icon}
        <Text style={[styles.optionText, isDestructive && styles.destructive]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#888",
  },
  optionsSection: {
    width: "100%",
    maxWidth: 400,
  },
  option: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: "#222",
    marginLeft: 16,
  },
  destructive: {
    color: "#d00",
    fontWeight: "bold",
  },
});
