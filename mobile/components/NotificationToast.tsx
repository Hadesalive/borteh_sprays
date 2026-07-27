import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const slide = useRef(new Animated.Value(0)).current; // 0 = hidden above, 1 = resting
  const dragY = useRef(new Animated.Value(0)).current; // finger-follow while swiping up
  const press = useRef(new Animated.Value(1)).current; // tactile scale under the finger
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

  const hide = () => {
    clearTimer();
    Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        dragY.setValue(0);
        press.setValue(1);
        setItem(null);
      }
    });
  };
  const hideRef = useRef(hide);
  hideRef.current = hide;

  useEffect(() => {
    listener = (n) => {
      if (pathRef.current === "/notifications") return; // inbox is live on-screen
      setItem(n);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dragY.setValue(0);
      press.setValue(1);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 6 }).start();
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
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => clearTimer(),
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) dragY.setValue(Math.max(g.dy, -160));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -24 || g.vy < -0.5) hideRef.current();
        else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
          armRef.current();
        }
      },
    }),
  ).current;

  const setPressed = (down: boolean) => {
    if (down) clearTimer();
    else armRef.current();
    Animated.spring(press, { toValue: down ? 0.97 : 1, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
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

  if (!item) return null;
  const { Icon, chip } = notifGlyph(item, colors);
  const thumb = item.imagePath ? imageUrl(item.imagePath) : null;
  const translateY = Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [-180, 0] }), dragY);
  const scale = Animated.multiply(slide.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }), press);

  return (
    <Animated.View
      style={[s.wrap, { top: insets.top + space.xs, transform: [{ translateY }] }]}
      pointerEvents="box-none"
      {...pan.panHandlers}
    >
      <Animated.View style={[s.shadow, { opacity: slide, transform: [{ scale }] }]}>
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
                <AppText variant="body" style={s.title} numberOfLines={1} maxFontSizeMultiplier={1.3}>
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
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { position: "absolute", left: space.md, right: space.md, zIndex: 100 },
  // depth: a whisper only — the 1px line border does the real separating.
  shadow: {
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      default: {},
    }),
  },
  card: { borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingTop: space.md, paddingBottom: space.sm, paddingHorizontal: space.lg, elevation: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  // "app icon": the Borteh flower on its own tile, zoomed so the mark reads at 48px
  mark: { width: 48, height: 48 },
  markTile: { width: 48, height: 48, borderRadius: 10, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  markImg: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.45 }] },
  badge: { position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  thumb: { width: 44, height: 44, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  nameRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  name: { color: colors.ink60 },
  time: { color: colors.ink40 },
  title: { fontFamily: font.medium, color: colors.ink, marginTop: 3 },
  body: { marginTop: 1 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: space.sm },
});
