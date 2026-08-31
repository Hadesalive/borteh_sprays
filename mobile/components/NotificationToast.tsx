import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { EASE_OUT } from "@/lib/animations";
import { type AppNotification, useMarkRead } from "@/lib/notifications";
import { imageUrl } from "@/lib/supabase";
import { Colors, font, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";
import { AppText } from "./Text";
import { notifGlyph } from "./NotifIcon";

// Heads-up banner (fed by the realtime stream in NotificationsLive). A grounded
// Maison card — surface fill, 1px line border, 14px radius, a whisper of shadow so
// it floats over the page without turning into a heavy stock toast. It follows the
// theme, so it reads paper-on-ink in dark mode too.
//
// The behavior is tuned to feel native: it drops on a spring, scales down under your
// finger, pauses its dismiss timer while touched, and flicks up to dismiss. The leading
// mark is the Borteh flower (the real app icon) with a small semantic status dot in the
// corner — the one-glance confirmed / on-the-way / cancelled cue — and the product photo
// rides on the right. Tap → open target + mark read · drag up to flick away · auto-dismisses.
//
// Built on Reanimated + Gesture Handler (not core Animated/PanResponder) so the drag
// tracks the finger on the UI thread and never drops a frame under JS-thread load.

let listener: ((n: AppNotification) => void) | null = null;
/** Show the banner (call from anywhere; no-op before the root component mounts). */
export function showNotificationToast(n: AppNotification) {
  listener?.(n);
}

const SHOW_MS = 5000;

export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const markRead = useMarkRead();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const [item, setItem] = useState<AppNotification | null>(null);
  const slide = useSharedValue(0); // 0 = hidden above, 1 = resting
  const dragY = useSharedValue(0); // finger-follow while swiping up
  const press = useSharedValue(1); // tactile scale under the finger
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const arm = () => {
    clearTimer();
    timer.current = setTimeout(() => hideRef.current(), SHOW_MS);
  };
  const armRef = useRef(arm);
  armRef.current = arm;
  const clearTimerRef = useRef(clearTimer);
  clearTimerRef.current = clearTimer;

  const hide = () => {
    clearTimer();
    // Exiting content always eases out, never in (ease-in delays the frame the
    // user is actually watching) — this used to run Easing.in(cubic).
    slide.set(
      withTiming(0, { duration: 200, easing: EASE_OUT }, (finished) => {
        "worklet";
        if (finished) {
          dragY.set(0);
          press.set(1);
          scheduleOnRN(setItem, null);
        }
      }),
    );
  };
  const hideRef = useRef(hide);
  hideRef.current = hide;

  useEffect(() => {
    listener = (n) => {
      if (pathRef.current === "/notifications") return; // inbox is live on-screen
      setItem(n);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dragY.set(0);
      press.set(1);
      slide.set(0);
      slide.set(withSpring(1, { duration: 400, dampingRatio: 0.75 }));
      armRef.current();
    };
    return () => {
      listener = null;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe up to dismiss — the card follows the finger, then commits or springs back.
  // Touching it pauses the auto-dismiss so a banner never vanishes mid-read.
  // activeOffsetY/failOffsetX reproduce the old onMoveShouldSetPanResponder gate:
  // only a clearly-vertical upward drag claims the gesture, so a plain tap still
  // reaches the Pressable underneath untouched.
  const panGesture = Gesture.Pan()
    .activeOffsetY(-6)
    .failOffsetX([-12, 12])
    .onStart(() => {
      "worklet";
      scheduleOnRN(clearTimerRef.current);
    })
    .onUpdate((e) => {
      "worklet";
      if (e.translationY < 0) dragY.set(Math.max(e.translationY, -160));
    })
    .onEnd((e) => {
      "worklet";
      if (e.translationY < -24 || e.velocityY < -500) {
        scheduleOnRN(hideRef.current);
      } else {
        dragY.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: e.velocityY }));
        scheduleOnRN(armRef.current);
      }
    });

  const setPressed = (down: boolean) => {
    if (down) clearTimer();
    else armRef.current();
    press.set(withTiming(down ? 0.97 : 1, { duration: down ? 120 : 150, easing: EASE_OUT }));
  };

  const open = () => {
    if (!item) return;
    markRead.mutate([item.id]);
    const isOrder = item.referenceType === "order" && item.referenceId;
    const isNotice = item.type === "promo" || item.type === "system";
    hide();
    if (isOrder) router.push({ pathname: "/order/[id]", params: { id: item.referenceId! } });
    else if (isNotice) router.push("/notices");
    else router.push("/notifications");
  };

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(slide.get(), [0, 1], [-180, 0]) + dragY.get() }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: slide.get(),
    transform: [{ scale: interpolate(slide.get(), [0, 1], [0.94, 1]) * press.get() }],
  }));

  if (!item) return null;
  const { Icon, chip } = notifGlyph(item, colors);
  const thumb = item.imagePath ? imageUrl(item.imagePath) : null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[s.wrap, { top: insets.top + space.xs }, wrapStyle]} pointerEvents="box-none">
        <Animated.View style={[s.shadow, cardStyle]}>
          <Pressable onPress={open} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} accessibilityRole="button" accessibilityLabel={`Borteh: ${item.title ?? item.body}`}>
            <View style={s.card}>
              <View style={s.row}>
                {/* the app-icon slot: the Borteh flower mark + a small semantic status dot */}
                <View style={s.mark}>
                  <View style={s.markTile}>
                    <Image source={require("../assets/icon.png")} style={s.markImg} contentFit="cover" />
                  </View>
                  <View style={[s.badge, { backgroundColor: chip }]}>
                    <Icon size={10} color={colors.paper} weight="fill" />
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.nameRow}>
                    <AppText variant="label" style={s.name} numberOfLines={1}>Borteh</AppText>
                    <AppText variant="caption" style={s.time} maxFontSizeMultiplier={1.2}>now</AppText>
                  </View>
                  {/* Title-less notifications (most of them) show the body HERE
                      instead — give it 2 lines like the body slot below gets,
                      not the 1-line headline limit meant for an actual title. */}
                  <AppText variant="body" style={s.title} numberOfLines={item.title ? 1 : 2} maxFontSizeMultiplier={1.3}>
                    {item.title ?? item.body}
                  </AppText>
                  {item.title ? (
                    <AppText variant="bodySoft" style={s.body} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                      {item.body}
                    </AppText>
                  ) : null}
                </View>
                {/* the perfume's photo rides on the right, in the tidy bordered-thumb language */}
                {thumb ? (
                  <View style={s.thumb}>
                    <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} />
                  </View>
                ) : null}
              </View>
              {/* grab handle — the flick-to-dismiss cue */}
              <View style={s.handle} />
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { position: "absolute", left: space.md, right: space.md, zIndex: 100 },
  // depth: a whisper only — the 1px line border does the real separating.
  // Square (radius 0), matching the Maison language used everywhere else now —
  // this toast was still carrying the old generic-template rounded-card treatment.
  shadow: {
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      default: {},
    }),
  },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingTop: space.md, paddingBottom: space.sm, paddingHorizontal: space.lg, elevation: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  // "app icon": the Borteh flower on its own tile, zoomed so the mark reads at 48px
  mark: { width: 48, height: 48 },
  markTile: { width: 48, height: 48, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  markImg: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.45 }] },
  badge: { position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  thumb: { width: 44, height: 44, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  nameRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  name: { color: colors.ink60 },
  time: { color: colors.ink40 },
  title: { fontFamily: font.medium, color: colors.ink, marginTop: 3 },
  body: { marginTop: 1 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: space.sm },
});
