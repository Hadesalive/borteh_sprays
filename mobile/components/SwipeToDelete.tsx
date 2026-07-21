import * as Haptics from "expo-haptics";
import { Trash } from "phosphor-react-native";
import { type ReactNode, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/Text";
import { colors, space } from "@/lib/theme";

// Swipe-left-to-delete without react-native-gesture-handler (not installed) — plain PanResponder
// + Animated, so no native module / rebuild. Swiping left reveals a Delete action; releasing past
// a short threshold snaps it open (tap to delete), and a long swipe deletes immediately. Only
// claims the gesture when it's clearly horizontal, so the parent ScrollView still scrolls.

const ACTION_W = 96;
const OPEN_AT = 48; // reveal the button past this
const DELETE_AT = 200; // long-swipe = delete outright

export function SwipeToDelete({ children, onDelete, label = "Delete" }: { children: ReactNode; onDelete: () => void; label?: string }) {
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  const settle = (toValue: number) => {
    openRef.current = toValue !== 0;
    Animated.spring(tx, { toValue, useNativeDriver: true, friction: 9, tension: 90 }).start();
  };
  const snapOpen = () => settle(-ACTION_W);
  const snapClosed = () => settle(0);

  const fireDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // slide fully out, then let the parent drop the row from its list
    Animated.timing(tx, { toValue: -600, duration: 180, useNativeDriver: true }).start(() => onDelete());
  };

  const pan = useRef(
    PanResponder.create({
      // Only take over when the drag is clearly horizontal-left — vertical stays with the list.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const base = openRef.current ? -ACTION_W : 0;
        const next = Math.min(0, Math.max(-ACTION_W - 80, base + g.dx)); // left only, slight overscroll
        tx.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const dx = (openRef.current ? -ACTION_W : 0) + g.dx;
        if (dx <= -DELETE_AT) fireDelete();
        else if (dx <= -OPEN_AT) snapOpen();
        else snapClosed();
      },
      onPanResponderTerminate: () => snapClosed(),
    }),
  ).current;

  return (
    <View style={s.wrap}>
      <Pressable style={s.action} onPress={fireDelete} accessibilityRole="button" accessibilityLabel={label}>
        <Trash size={20} color={colors.onInk} weight="regular" />
        <AppText variant="caption" style={s.actionLabel}>{label}</AppText>
      </Pressable>
      <Animated.View style={{ transform: [{ translateX: tx }], backgroundColor: colors.paper }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
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
