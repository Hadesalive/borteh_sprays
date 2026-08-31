import * as Haptics from "expo-haptics";
import { Trash } from "phosphor-react-native";
import { type ReactNode, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { AppText } from "@/components/Text";
import { EASE_OUT } from "@/lib/animations";
import { Colors, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";

// Swipe-left-to-delete on Gesture.Pan() + Reanimated (gesture-handler is
// installed — this used to run on a plain PanResponder from before it was).
// Swiping left reveals a Delete action; releasing past a short threshold
// snaps it open (tap to delete), and a long swipe deletes immediately. Only
// claims the gesture when it's clearly horizontal, so the parent ScrollView
// still scrolls — and interruption (another gesture stealing the touch, e.g.
// a system edge-swipe) always snaps closed, same as the old onPanResponderTerminate.

const ACTION_W = 96;
const OPEN_AT = 48; // reveal the button past this
const DELETE_AT = 200; // long-swipe = delete outright
const SNAP_SPRING = { duration: 400, dampingRatio: 0.8 };

export function SwipeToDelete({ children, onDelete, label = "Delete" }: { children: ReactNode; onDelete: () => void; label?: string }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const tx = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const fireDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    isOpen.set(false);
    // slide fully out, then let the parent drop the row from its list
    tx.set(
      withTiming(-600, { duration: 180, easing: EASE_OUT }, (finished) => {
        "worklet";
        if (finished) scheduleOnRN(onDeleteRef.current);
      }),
    );
  };
  const fireDeleteRef = useRef(fireDelete);
  fireDeleteRef.current = fireDelete;

  const panGesture = Gesture.Pan()
    // Only take over when the drag is clearly horizontal — vertical stays with the list.
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      "worklet";
      const base = isOpen.get() ? -ACTION_W : 0;
      tx.set(Math.min(0, Math.max(-ACTION_W - 80, base + e.translationX))); // left only, slight overscroll
    })
    .onEnd((e, success) => {
      "worklet";
      if (!success) {
        isOpen.set(false);
        tx.set(withSpring(0, SNAP_SPRING));
        return;
      }
      const base = isOpen.get() ? -ACTION_W : 0;
      const dx = base + e.translationX;
      if (dx <= -DELETE_AT) {
        scheduleOnRN(fireDeleteRef.current);
      } else if (dx <= -OPEN_AT) {
        isOpen.set(true);
        tx.set(withSpring(-ACTION_W, { ...SNAP_SPRING, velocity: e.velocityX }));
      } else {
        isOpen.set(false);
        tx.set(withSpring(0, { ...SNAP_SPRING, velocity: e.velocityX }));
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }],
    backgroundColor: colors.paper,
  }));

  return (
    <View style={s.wrap}>
      <Pressable style={s.action} onPress={fireDelete} accessibilityRole="button" accessibilityLabel={label}>
        <Trash size={20} color={colors.onInk} weight="regular" />
        <AppText variant="caption" style={s.actionLabel}>{label}</AppText>
      </Pressable>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { overflow: "hidden" },
  action: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_W,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  actionLabel: { color: colors.onInk },
});
