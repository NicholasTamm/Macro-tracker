import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Modal animation honouring the OS Reduce Motion setting (M1-21). */
export function modalAnimationFor(reduceMotion: boolean): 'none' | 'slide' {
  return reduceMotion ? 'none' : 'slide';
}

/**
 * Tracks the OS "Reduce Motion" (iOS) / "Remove animations" (Android) setting.
 * Defaults to false until the async query resolves; web resolves false.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
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
