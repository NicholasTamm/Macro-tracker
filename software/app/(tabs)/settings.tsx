import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import userIcon from '../../assets/images/userIcon.jpg';
import ThemedView from '../../components/ThemedView';
import { useUserData } from '@/components/UserDataProvider';
import {
  buildUserDataExportFiles,
  shareExportViaPlatform,
  EXPO_FILE_SHARE_PATH_DOC,
} from '@/modules/app-core/export';
import { ActivityIndicator } from 'react-native';
import { isCoachingShellEntryEnabled } from '@/modules/coaching';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
  const { db, ready } = useUserData();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const onExport = async () => {
    if (!db) {
      setExportMessage('User data not ready.');
      return;
    }
    setExporting(true);
    setExportMessage(null);
    try {
      const files = buildUserDataExportFiles(db);
      const result = await shareExportViaPlatform(files);
      if (!result.ok) {
        setExportMessage(result.reason);
      } else {
        setExportMessage(
          `Exported JSON (${files.suggestedJsonName}) + CSV via share sheet. ${EXPO_FILE_SHARE_PATH_DOC.split('\n')[0]}`,
        );
      }
    } catch (e) {
      setExportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.profileSection}>
            <Image source={userIcon} style={styles.avatar} />
            <Text style={styles.name}>User Name</Text>
            <CoachingShellStatus />
          </View>

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
              label={exporting ? 'Exporting…' : 'Export data (CSV + JSON)'}
              icon={<Feather name="download" size={22} color="#222" />}
              onPress={ready && !exporting ? onExport : undefined}
            />
            {exporting ? (
              <ActivityIndicator style={{ marginVertical: 8 }} />
            ) : null}
            {exportMessage ? (
              <Text style={{ paddingHorizontal: 24, color: '#666', fontSize: 13, marginBottom: 8 }}>
                {exportMessage}
              </Text>
            ) : null}
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
  onPress,
}: {
  label: string;
  icon: ReactNode;
  isDestructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.option}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
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
    backgroundColor: '#fff',
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  profileSection: {
    alignItems: 'center',
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
    fontWeight: 'bold',
    marginBottom: 4,
  },
  optionsSection: {
    width: '100%',
    maxWidth: 400,
  },
  option: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#222',
    marginLeft: 16,
  },
  destructive: {
    color: '#d00',
    fontWeight: 'bold',
  },
});


function CoachingShellStatus() {
  const { snapshot } = useUserData();
  if (!snapshot) return null;
  const on = isCoachingShellEntryEnabled({
    isAdultConfirmed: snapshot.profile.isAdultConfirmed,
    exclusions: snapshot.profile.exclusions,
  });
  return (
    <Text style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
      Coaching shell: {on ? 'eligible (stub)' : 'disabled'}
    </Text>
  );
}
