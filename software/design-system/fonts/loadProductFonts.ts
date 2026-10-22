import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { FONT_DISPLAY } from '../tokens/typography';

/**
 * Deterministic MacroSans load. Screens size type with fixed lineHeights so
 * falling back to the system face before load completes does not reflow.
 */
export async function loadProductFonts(): Promise<void> {
  await Font.loadAsync({
    [FONT_DISPLAY]: require('../../assets/fonts/MacroSans-VF.ttf'),
  });
}

export function useProductFonts(): { fontsLoaded: boolean; fontError: Error | null } {
  const [fontsLoaded, setFontsLoaded] = useState(Font.isLoaded(FONT_DISPLAY));
  const [fontError, setFontError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (fontsLoaded) return;
    loadProductFonts()
      .then(() => {
        if (!cancelled) setFontsLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFontError(err instanceof Error ? err : new Error(String(err)));
          // Keep UI mounted on system fallback — no blocking splash.
          setFontsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded]);

  return { fontsLoaded, fontError };
}
