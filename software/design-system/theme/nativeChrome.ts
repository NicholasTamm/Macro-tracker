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
  await adapters.setRootBackgroundColor(canvas);
  if (platform === 'android') {
    await adapters.setNavigationButtonStyle(scheme === 'dark' ? 'light' : 'dark');
  }
}
