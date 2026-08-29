import { useCallback } from "react";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

// Shared motion tokens — reuse these curves everywhere instead of approximating.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** Press feedback: scale(0.97) on press-in, spring back on press-out. Wrap the
 *  Pressable's child in <Animated.View style={pressStyle}> and pass onPressIn/
 *  onPressOut to the Pressable. State-driven, no gesture — stays on the UI thread. */
export function usePressScale(pressedScale = 0.97) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const onPressIn = useCallback(() => {
    scale.set(withTiming(pressedScale, { duration: 120, easing: EASE_OUT }));
  }, [scale, pressedScale]);
  const onPressOut = useCallback(() => {
    scale.set(withTiming(1, { duration: 150, easing: EASE_OUT }));
  }, [scale]);
  return { pressStyle, onPressIn, onPressOut };
}
