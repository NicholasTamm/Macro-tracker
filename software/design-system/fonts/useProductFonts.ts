import { useFonts } from 'expo-font';
// Per-weight subpaths so only the six faces we use are bundled.
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';

/** Figtree (UI) + Nunito (display), OFL-1.1. Keys match typography.ts family names. */
export const PRODUCT_FONT_MAP = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
};

/**
 * Loads product fonts without blocking render. Returns true only once every
 * face is available; on failure stays false so text keeps the system scale.
 */
export function useProductFonts(): boolean {
  const [loaded, error] = useFonts(PRODUCT_FONT_MAP);
  return loaded && !error;
}
