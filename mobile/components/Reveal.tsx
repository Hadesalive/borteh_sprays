import { type ReactNode, useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, type ViewStyle } from "react-native";

/** Fades + rises its children in on mount. `delay` staggers a sequence of sections.
 *  Honors Reduce Motion (snaps to visible). */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        v.setValue(1);
        return;
      }
      Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [v, delay]);

  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
