import {
  loadOnboardingSnapshot,
  type OnboardingSnapshot,
  type SqlExecutor,
} from '@/modules/app-core/user-data';
import {
  getThemePreference,
  type ThemePreference,
} from '@/modules/app-core/settings';

export type UserDataProviderState = {
  snapshot: OnboardingSnapshot;
  themePreference: ThemePreference;
};

/** Read the provider-facing state. This must never write diary data. */
export function loadUserDataProviderState(db: SqlExecutor): UserDataProviderState {
  return {
    snapshot: loadOnboardingSnapshot(db),
    themePreference: getThemePreference(db),
  };
}
