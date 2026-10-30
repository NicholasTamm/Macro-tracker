import type { ColorSchemeName } from '../tokens';

type NativeChromeAdapters = {
  setRootBackgroundColor: (color: string) => Promise<void>;
  setNavigationButtonStyle: (style: 'light' | 'dark') => Promise<void>;
};

export async function syncNativeChrome(
  platform: string,
  scheme: ColorSchemeName,
  canvas: string,
  adapters: NativeChromeAdapters,
): Promise<void> {
  await Promise.all([
    adapters.setRootBackgroundColor(canvas),
    platform === 'android'
      ? adapters.setNavigationButtonStyle(scheme === 'dark' ? 'light' : 'dark')
      : Promise.resolve(),
  ]);
}
