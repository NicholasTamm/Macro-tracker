import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Modal animation honouring the OS Reduce Motion setting (M1-21). */
export function modalAnimationFor(reduceMotion: boolean | null): 'none' | 'slide' {
  return reduceMotion === false ? 'slide' : 'none';
}

/**
 * Tracks the OS "Reduce Motion" (iOS) / "Remove animations" (Android) setting.
 * Defaults to unknown until the async query resolves so motion stays disabled.
 */
export function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (mounted) setReduce(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) =>
      setReduce(!!v),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}
