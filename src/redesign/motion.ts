import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
/** No entrance or scale animation until the OS accessibility setting is known. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { if (active) setReduced(value); });
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}
