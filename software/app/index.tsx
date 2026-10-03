import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useUserData } from '@/components/UserDataProvider';
import { useTheme } from '@/design-system';

export default function Index() {
  const { ready, snapshot, error } = useUserData();
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}
      >
        <ActivityIndicator color={colors.ink} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (error) {
    // Fail open to onboarding so the user can still proceed offline.
    return <Redirect href="/onboarding/adult" />;
  }

  if (!snapshot?.complete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/food-entry" />;
}
